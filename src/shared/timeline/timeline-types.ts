export type TimelineItemType = 'event' | 'task' | 'note' | 'reminder' | 'habit' | 'focus';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
  allDay: boolean;
  color?: string;
  icon?: string;
  isCompleted: boolean;
  calendarId?: string;
  
  /**
   * The raw underlying domain object (Task, Event, Note, etc.).
   * This is used when mutating the item back to the database.
   */
  originalItem: any;
}

export interface DragEventContext {
  item: TimelineItem;
  newStart: Date;
  newEnd: Date;
}
