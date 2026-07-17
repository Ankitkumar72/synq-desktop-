import { CalendarItem } from '../types';
import { SchedulingIntent } from './SchedulingIntent';

export class RepairEngine {
  /**
   * Automatically repairs a proposal that has repairable errors.
   * - Fixes inverted date ranges (start > end)
   * - Enforces the minimum duration of 15 minutes
   * - Clamps timestamps to reasonable chronological bounds
   */
  static repair(
    start: Date,
    end: Date,
    originalItem: CalendarItem,
    intent: SchedulingIntent
  ): { start: Date; end: Date } {
    let repairedStart = new Date(start);
    let repairedEnd = new Date(end);

    // 1. Fix inverted start/end dates
    if (repairedStart.getTime() > repairedEnd.getTime()) {
      if (intent.type === 'resize') {
        if (intent.edge === 'top') {
          // Resizing top above bottom limit: push start above end
          repairedStart = new Date(repairedEnd.getTime() - 15 * 60 * 1000);
        } else {
          // Resizing bottom below top limit: push end below start
          repairedEnd = new Date(repairedStart.getTime() + 15 * 60 * 1000);
        }
      } else {
        // In case of moves, swap them
        const temp = repairedStart;
        repairedStart = repairedEnd;
        repairedEnd = temp;
      }
    }

    // 2. Enforce minimum duration (15 minutes)
    const minDurationMs = 15 * 60 * 1000;
    const durationMs = repairedEnd.getTime() - repairedStart.getTime();
    if (durationMs < minDurationMs) {
      if (intent.type === 'resize' && intent.edge === 'top') {
        // Adjust start time to preserve minimum duration
        repairedStart = new Date(repairedEnd.getTime() - minDurationMs);
      } else {
        // Adjust end time
        repairedEnd = new Date(repairedStart.getTime() + minDurationMs);
      }
    }

    // 3. Clamp year range to prevent overflow crashes
    if (repairedStart.getFullYear() < 1970) {
      repairedStart.setFullYear(1970);
    }
    if (repairedEnd.getFullYear() > 2100) {
      repairedEnd.setFullYear(2100);
    }

    return { start: repairedStart, end: repairedEnd };
  }
}
