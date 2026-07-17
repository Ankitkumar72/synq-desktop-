import { CalendarItem, DragSessionState, ColumnRect } from '../types';
import { SchedulingEngine } from './SchedulingEngine';
import { CoordinateMapper } from './CoordinateMapper';
import { InteractionStateMachine } from './InteractionStateMachine';
import { SchedulingIntent } from './SchedulingIntent';

type Listener = (state: DragSessionState) => void;

export class DragController {
  private state: DragSessionState;
  private listeners: Set<Listener> = new Set();
  private stateMachine: InteractionStateMachine;
  private resizeEdge: 'top' | 'bottom' | null = null;

  constructor(
    private schedulingEngine: SchedulingEngine,
    private mapper: CoordinateMapper
  ) {
    this.stateMachine = new InteractionStateMachine();
    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: false,
      previewModel: null,
    };

    // Sync state status with StateMachine transitions
    this.stateMachine.subscribe((status) => {
      this.state.status = status;
      this.notify();
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  getState(): DragSessionState {
    return this.state;
  }

  beginDrag(event: CalendarItem, startPointer: { x: number; y: number }) {
    this.resizeEdge = null;
    this.stateMachine.transitionTo('pointerdown');
    
    this.state = {
      originalEvent: event,
      previewEvent: { ...event },
      pointer: startPointer,
      status: 'pointerdown',
      accepted: false,
      previewModel: null,
    };
    
    this.stateMachine.transitionTo('dragging');
    this.notify();
  }

  updateDrag(pointer: { x: number; y: number }, columns: ColumnRect[], hourHeight: number) {
    if (this.state.status !== 'dragging' || !this.state.originalEvent) return;

    this.state.pointer = pointer;

    // 1. Locate column boundaries using pointer X
    let targetCol = columns.find(col => pointer.x >= col.left && pointer.x <= col.right);
    if (!targetCol && columns.length > 0) {
      if (pointer.x < columns[0].left) {
        targetCol = columns[0];
      } else {
        targetCol = columns[columns.length - 1];
      }
    }

    if (targetCol) {
      // 2. Map coordinates relative to column to establish time offset
      const relativeY = Math.max(0, Math.min(targetCol.bottom - targetCol.top, pointer.y - targetCol.top));
      const hours = relativeY / hourHeight;

      const proposedStart = new Date(targetCol.date);
      proposedStart.setHours(0, 0, 0, 0);
      proposedStart.setMinutes(hours * 60);

      // Preserve the event duration
      const durationMs = this.state.originalEvent.end.getTime() - this.state.originalEvent.start.getTime();
      const proposedEnd = new Date(proposedStart.getTime() + durationMs);

      // 3. Create move intent
      const intent: SchedulingIntent = {
        type: 'move',
        itemId: this.state.originalEvent.id,
        proposedStart,
        proposedEnd,
      };

      // 4. Delegate to SchedulingEngine
      const { start, end, preview } = this.schedulingEngine.process(
        intent,
        this.state.originalEvent,
        columns
      );

      preview.position = pointer;

      this.state.previewEvent = {
        ...this.state.originalEvent,
        start,
        end,
      };
      this.state.previewModel = preview;
    }

    this.notify();
  }

  beginResize(event: CalendarItem, startPointer: { x: number; y: number }, edge: 'top' | 'bottom') {
    this.resizeEdge = edge;
    this.stateMachine.transitionTo('pointerdown');

    this.state = {
      originalEvent: event,
      previewEvent: { ...event },
      pointer: startPointer,
      status: 'pointerdown',
      accepted: false,
      previewModel: null,
    };

    this.stateMachine.transitionTo('resizing');
    this.notify();
  }

  updateResize(pointer: { x: number; y: number }, columns: ColumnRect[], hourHeight: number) {
    if (this.state.status !== 'resizing' || !this.state.originalEvent || !this.resizeEdge) return;

    this.state.pointer = pointer;

    const originalStart = this.state.originalEvent.start;
    const originalEnd = this.state.originalEvent.end;

    // Resizing is vertical within the day of start
    const originalDate = new Date(originalStart);
    let targetCol = columns.find(col => {
      const d1 = new Date(col.date);
      return d1.getFullYear() === originalDate.getFullYear() &&
             d1.getMonth() === originalDate.getMonth() &&
             d1.getDate() === originalDate.getDate();
    });

    if (!targetCol && columns.length > 0) {
      targetCol = columns.find(col => pointer.x >= col.left && pointer.x <= col.right);
    }

    if (targetCol) {
      const relativeY = Math.max(0, Math.min(targetCol.bottom - targetCol.top, pointer.y - targetCol.top));
      const hours = relativeY / hourHeight;

      const proposedTime = new Date(targetCol.date);
      proposedTime.setHours(0, 0, 0, 0);
      proposedTime.setMinutes(hours * 60);

      let proposedStart = originalStart;
      let proposedEnd = originalEnd;

      if (this.resizeEdge === 'top') {
        proposedStart = proposedTime;
      } else {
        proposedEnd = proposedTime;
      }

      // 1. Create resize intent
      const intent: SchedulingIntent = {
        type: 'resize',
        itemId: this.state.originalEvent.id,
        proposedStart,
        proposedEnd,
        edge: this.resizeEdge,
      };

      // 2. Delegate to SchedulingEngine
      const { start, end, preview } = this.schedulingEngine.process(
        intent,
        this.state.originalEvent,
        columns
      );

      preview.position = pointer;

      this.state.previewEvent = {
        ...this.state.originalEvent,
        start,
        end,
      };
      this.state.previewModel = preview;
    }

    this.notify();
  }

  cancelDrag() {
    this.resizeEdge = null;
    this.stateMachine.transitionTo('cancelled');

    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: false,
      previewModel: null,
    };

    this.stateMachine.transitionTo('idle');
    this.notify();
  }

  commitDrag(): CalendarItem | null {
    if (this.state.status === 'idle') return null;

    this.stateMachine.transitionTo('dropping');
    this.stateMachine.transitionTo('committing');

    const committedEvent = this.state.previewEvent;

    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: true,
      previewModel: null,
    };

    this.stateMachine.transitionTo('finished');
    this.stateMachine.transitionTo('idle');
    this.notify();

    return committedEvent;
  }
}
