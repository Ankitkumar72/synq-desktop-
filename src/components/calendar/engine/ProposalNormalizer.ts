import { SchedulingIntent } from './SchedulingIntent';

export class ProposalNormalizer {
  /**
   * Normalizes proposed start and end dates.
   * - Sets seconds and milliseconds to 0
   * - Swaps start/end if they are inverted
   * - Rounds to the nearest snap interval if provided
   */
  static normalize(
    intent: SchedulingIntent,
    options: { intervalMinutes?: number } = {}
  ): { start: Date; end: Date } {
    let start = new Date(intent.proposedStart);
    let end = new Date(intent.proposedEnd);

    // 1. Clear seconds and milliseconds
    start.setSeconds(0, 0);
    end.setSeconds(0, 0);

    // 2. Swaps invalid start/end
    if (start.getTime() > end.getTime()) {
      const temp = start;
      start = end;
      end = temp;
    }

    // 3. Round to snap interval if requested
    if (options.intervalMinutes && options.intervalMinutes > 0) {
      const ms = 1000 * 60 * options.intervalMinutes;
      start = new Date(Math.round(start.getTime() / ms) * ms);
      end = new Date(Math.round(end.getTime() / ms) * ms);
    }

    return { start, end };
  }
}
