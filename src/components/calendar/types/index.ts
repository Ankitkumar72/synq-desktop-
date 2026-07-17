import { TimelineItem } from "@/shared/timeline/timeline-types"

export type CalendarItem = TimelineItem

export interface EventRect {
  x: number;
  y: number;
  width: number;
  height: number;
  eventId: string;
}

import { InteractionState } from '../engine/InteractionStateMachine';
import { PreviewModel } from '../engine/PreviewModel';

export type DragStatus = InteractionState;

export interface DragSessionState {
  originalEvent: CalendarItem | null;
  previewEvent: CalendarItem | null;
  pointer: { x: number; y: number } | null;
  status: DragStatus;
  accepted: boolean;
  previewModel: PreviewModel | null;
}

export interface CalendarTransaction {
  id: string;
  before: CalendarItem;
  after: CalendarItem;
  timestamp: number;
  userId?: string;
}

export interface ColumnRect {
  date: Date;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

