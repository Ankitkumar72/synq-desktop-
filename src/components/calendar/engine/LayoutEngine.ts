import { CalendarItem, EventRect, DragSessionState } from '../types';
import { CoordinateMapper } from './CoordinateMapper';
import { CollisionEngine } from './CollisionEngine';

export class LayoutEngine {
  constructor(private mapper: CoordinateMapper) {}

  /**
   * Calculates the positioning rectangles for a list of items within a day column.
   */
  calculateDayRects(
    items: CalendarItem[],
    columnWidth: number,
    dragSession: DragSessionState | null = null
  ): EventRect[] {
    const collisionLayouts = CollisionEngine.resolve(items);
    const rects: EventRect[] = [];

    for (const item of items) {
      const layout = collisionLayouts.get(item.id) || { col: 0, maxCols: 1 };
      
      const { start, end } = this.getStartAndEnd(item);
      
      // Map time to Y and Height
      const top = this.mapper.timeToPixel(start);
      let bottom = this.mapper.timeToPixel(end);
      
      // Enforce minimum duration of 30 minutes visually
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      if (durationMinutes < 30) {
         const baseDate = new Date();
         baseDate.setHours(0, 0, 0, 0);
         const halfHourDate = new Date();
         halfHourDate.setHours(0, 30, 0, 0);
         const minHeight = this.mapper.timeToPixel(halfHourDate) - this.mapper.timeToPixel(baseDate);
         bottom = top + minHeight;
      }

      // Map width and X based on collision layout
      // Example: 2 events overlapping -> width is 50% for each
      const w = columnWidth / layout.maxCols;
      const x = w * layout.col;
      const height = bottom - top;
      
      // Override with drag session preview if this is the dragged event
      if (dragSession && dragSession.originalEvent?.id === item.id) {
         // If dragging, we might want to return the preview's coordinates or hide the original.
         // For now, we just pass the original. The OverlayLayer handles rendering the dragged preview.
      }

      rects.push({
        eventId: item.id,
        x: x,
        y: top,
        width: w,
        height: height,
      });
    }

    return rects;
  }

  private getStartAndEnd(item: CalendarItem): { start: Date; end: Date } {
    const start = item.type === 'event'
      ? new Date(item.start_date)
      : new Date(item.start_at || item.due_date!);
      
    const end = item.type === 'event'
      ? new Date(item.end_date)
      : new Date(item.end_at || new Date(start.getTime() + 30 * 60000));

    return { start, end };
  }
}
