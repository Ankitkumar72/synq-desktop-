import { TimelineItem } from '@/shared/timeline/timeline-types';

export interface TimelineLayoutNode {
  item: TimelineItem;
  top: number;
  height: number;
  left: number; // percentage (0 to 1)
  width: number; // percentage (0 to 1)
}

/**
 * Calculates absolute positioning and width constraints for overlapping timeline items.
 * Uses a greedy layout algorithm similar to Google Calendar.
 */
export function calculateTimelineLayout(
  items: TimelineItem[],
  pixelsPerMinute: number,
  startOfDayHours: number = 0
): TimelineLayoutNode[] {
  if (items.length === 0) return [];

  // 1. Map to raw nodes with top/height
  const nodes = items.map(item => {
    const startMinutes = item.start.getHours() * 60 + item.start.getMinutes() - (startOfDayHours * 60);
    const endMinutes = item.end.getHours() * 60 + item.end.getMinutes() - (startOfDayHours * 60);
    const duration = Math.max(endMinutes - startMinutes, 15); // min 15 minutes visual height

    return {
      item,
      top: startMinutes * pixelsPerMinute,
      height: duration * pixelsPerMinute,
      startMinutes,
      endMinutes: startMinutes + duration,
      left: 0,
      width: 1,
      column: 0,
      group: [] as any[]
    };
  });

  // 2. Sort by start time, then by end time descending (longer items first)
  nodes.sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    return b.endMinutes - a.endMinutes;
  });

  // 3. Group intersecting items
  const groups: (typeof nodes)[] = [];
  let currentGroup: typeof nodes = [];
  let groupEnd = 0;

  nodes.forEach(node => {
    if (currentGroup.length === 0) {
      currentGroup.push(node);
      groupEnd = node.endMinutes;
    } else if (node.startMinutes < groupEnd) {
      // Overlaps with the current group
      currentGroup.push(node);
      groupEnd = Math.max(groupEnd, node.endMinutes);
    } else {
      // Starts after the current group ends
      groups.push(currentGroup);
      currentGroup = [node];
      groupEnd = node.endMinutes;
    }
    node.group = currentGroup;
  });
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // 4. Assign columns within each group
  groups.forEach(group => {
    const columns: (typeof nodes)[] = [];

    group.forEach(node => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const lastInColumn = column[column.length - 1];
        if (lastInColumn.endMinutes <= node.startMinutes) {
          column.push(node);
          node.column = i;
          placed = true;
          break;
        }
      }
      if (!placed) {
        node.column = columns.length;
        columns.push([node]);
      }
    });

    // Now calculate left and width
    const numCols = columns.length;
    group.forEach(node => {
      node.left = node.column / numCols;
      
      // Expand width if subsequent columns are empty at this time
      let span = 1;
      for (let i = node.column + 1; i < numCols; i++) {
        const col = columns[i];
        const overlaps = col.some(c => c.startMinutes < node.endMinutes && c.endMinutes > node.startMinutes);
        if (overlaps) break;
        span++;
      }
      
      node.width = span / numCols;
    });
  });

  return nodes.map(n => ({
    item: n.item,
    top: n.top,
    height: n.height,
    left: n.left,
    width: n.width
  }));
}
