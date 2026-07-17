export type SnapInterval = 5 | 10 | 15 | 30 | 'adaptive';

export class SnapPolicy {
  constructor(private interval: SnapInterval = 15) {}

  setInterval(interval: SnapInterval) {
    this.interval = interval;
  }

  getIntervalMinutes(): number {
    if (this.interval === 'adaptive') {
      // In adaptive snapping, snap interval could change based on zoom level or time of day.
      // Here we implement a simple default of 15 minutes.
      return 15;
    }
    return this.interval;
  }

  /**
   * Snaps a Date to the nearest interval boundary.
   */
  snap(date: Date): Date {
    const intervalMinutes = this.getIntervalMinutes();
    const ms = 1000 * 60 * intervalMinutes;
    return new Date(Math.round(date.getTime() / ms) * ms);
  }

  /**
   * Snaps a duration in minutes to the nearest interval boundary.
   */
  snapDuration(durationMinutes: number): number {
    const intervalMinutes = this.getIntervalMinutes();
    return Math.round(durationMinutes / intervalMinutes) * intervalMinutes;
  }
}
