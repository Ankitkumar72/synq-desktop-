import { CalendarItem, EventRect, DragSessionState } from '../types';
import { CoordinateMapper } from './CoordinateMapper';
import { CollisionEngine } from './CollisionEngine';
import { LayoutCache } from './LayoutCache';

export class LayoutEngine {
  private cache = new LayoutCache();

  constructor(private mapper: CoordinateMapper) {}

  /**
   * Calculates the positioning rectangles for a list of items within a day column.
   */
  calculateDayRects(
    items: CalendarItem[],
    columnWidth: number,
    dragSession: DragSessionState | null = null
  ): EventRect[] {
    // If items list is not empty, try cache lookup first
    if (items.length > 0) {
      const dayDate = new Date(items[0].start);
      if (dragSession && (dragSession.status === 'dragging' || dragSession.status === 'resizing')) {
        // Invalidate on active drag sessions to capture live changes
        this.cache.invalidate(dayDate);
      } else {
        const cached = this.cache.get(dayDate);
        if (cached) {
          return cached;
        }
      }
    }

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
      const w = columnWidth / layout.maxCols;
      const x = w * layout.col;
      const height = bottom - top;

      rects.push({
        eventId: item.id,
        x: x,
        y: top,
        width: w,
        height: height,
      });
    }

    // Cache the completed calculation if we aren't dragging
    if (items.length > 0 && !(dragSession && (dragSession.status === 'dragging' || dragSession.status === 'resizing'))) {
      const dayDate = new Date(items[0].start);
      this.cache.set(dayDate, rects);
    }

    return rects;
  }

  private getStartAndEnd(item: CalendarItem): { start: Date; end: Date } {
    return { start: item.start, end: item.end };
  }

  invalidateCache(date: Date) {
    this.cache.invalidate(date);
  }

  clearCache() {
    this.cache.clear();
  }
}
