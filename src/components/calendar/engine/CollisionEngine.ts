import { CalendarItem } from '../types';

export interface LayoutDetails {
  col: number;
  maxCols: number;
}

export class CollisionEngine {
  private static getStartAndEnd(item: CalendarItem): { start: Date; end: Date } {
    return { start: item.start, end: item.end };
  }

  /**
   * Resolves overlaps among a set of items (expected to be on the same day).
   * Returns a map of itemId to its horizontal layout details.
   */
  static resolve(items: CalendarItem[]): Map<string, LayoutDetails> {
    const layoutMap = new Map<string, LayoutDetails>();
    if (items.length === 0) return layoutMap;

    // 1. Sort items by start time, then by end time (longest first)
    const sortedItems = [...items].sort((a, b) => {
      const aTimes = this.getStartAndEnd(a);
      const bTimes = this.getStartAndEnd(b);
      const startDiff = aTimes.start.getTime() - bTimes.start.getTime();
      if (startDiff !== 0) return startDiff;
      const aDuration = aTimes.end.getTime() - aTimes.start.getTime();
      const bDuration = bTimes.end.getTime() - bTimes.start.getTime();
      return bDuration - aDuration;
    });

    // 2. Group into overlapping clusters
    const groups: CalendarItem[][] = [];
    let currentGroup: CalendarItem[] = [];
    let groupEnd = new Date(0);

    for (const item of sortedItems) {
      const { start, end } = this.getStartAndEnd(item);
      if (currentGroup.length === 0) {
        currentGroup.push(item);
        groupEnd = end;
      } else if (start.getTime() < groupEnd.getTime()) {
        currentGroup.push(item);
        if (end.getTime() > groupEnd.getTime()) {
          groupEnd = end;
        }
      } else {
        groups.push([...currentGroup]);
        currentGroup = [item];
        groupEnd = end;
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // 3. Assign columns within each group
    for (const group of groups) {
      const columns: CalendarItem[][] = [];

      for (const item of group) {
        const { start } = this.getStartAndEnd(item);
        let placed = false;

        for (const col of columns) {
          const lastItemInCol = col[col.length - 1];
          const lastItemTimes = this.getStartAndEnd(lastItemInCol);
          if (lastItemTimes.end.getTime() <= start.getTime()) {
            col.push(item);
            placed = true;
            break;
          }
        }

        if (!placed) {
          columns.push([item]);
        }
      }

      // Record layout info
      const maxCols = columns.length;
      columns.forEach((colItems, colIndex) => {
        colItems.forEach(item => {
          layoutMap.set(item.id, { col: colIndex, maxCols });
        });
      });
    }

    return layoutMap;
  }
}
