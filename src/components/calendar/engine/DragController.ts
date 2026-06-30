import { CalendarItem, DragSessionState } from '../types';
import { SnapEngine } from './SnapEngine';
import { CoordinateMapper } from './CoordinateMapper';

type Listener = (state: DragSessionState) => void;

export class DragController {
  private state: DragSessionState;
  private listeners: Set<Listener> = new Set();
  
  constructor(
    private snapEngine: SnapEngine,
    private mapper: CoordinateMapper
  ) {
    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: false,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  getState(): DragSessionState {
    return this.state;
  }

  beginDrag(event: CalendarItem, startPointer: { x: number, y: number }) {
    this.state = {
      originalEvent: event,
      previewEvent: { ...event }, // Shallow copy for preview
      pointer: startPointer,
      status: 'dragging',
      accepted: false,
    };
    this.notify();
  }

  updateDrag(pointer: { x: number, y: number }) {
    if (this.state.status !== 'dragging' || !this.state.originalEvent) return;
    
    // Update pointer
    this.state.pointer = pointer;
    
    // Here we would use coordinate mapper to figure out the delta,
    // apply it to the originalEvent time, and snap it with snapEngine.
    
    // For now, this just notifies UI that pointer moved.
    // The exact preview calculation might also rely on the day column.
    
    this.notify();
  }

  cancelDrag() {
    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: false,
    };
    this.notify();
  }

  commitDrag(): CalendarItem | null {
    if (this.state.status !== 'dragging') return null;
    
    const committedEvent = this.state.previewEvent;
    
    this.state = {
      originalEvent: null,
      previewEvent: null,
      pointer: null,
      status: 'idle',
      accepted: true,
    };
    this.notify();
    
    return committedEvent;
  }
}
