export interface MoveEventIntent {
  type: "move";
  itemId: string;
  proposedStart: Date;
  proposedEnd: Date;
}

export interface ResizeEventIntent {
  type: "resize";
  itemId: string;
  proposedStart: Date;
  proposedEnd: Date;
  edge: "top" | "bottom";
}

export type SchedulingIntent = MoveEventIntent | ResizeEventIntent;
