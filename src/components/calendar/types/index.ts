import { Task, CalendarEvent } from "@/shared"

export type CalendarItem = (Task & { type: 'task' }) | (CalendarEvent & { type: 'event' })

export interface EventRect {
  x: number;
  y: number;
  width: number;
  height: number;
  eventId: string;
}

export type DragStatus = 'idle' | 'dragging' | 'resizing';

export interface DragSessionState {
  originalEvent: CalendarItem | null;
  previewEvent: CalendarItem | null;
  pointer: { x: number; y: number } | null;
  status: DragStatus;
  accepted: boolean;
}

export interface CalendarTransaction {
  id: string;
  before: CalendarItem;
  after: CalendarItem;
  timestamp: number;
  userId?: string;
}
