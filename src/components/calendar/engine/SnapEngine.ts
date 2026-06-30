export class SnapEngine {
  private intervalMinutes: number;

  constructor(intervalMinutes: number = 15) {
    this.intervalMinutes = intervalMinutes;
  }

  setInterval(minutes: number) {
    this.intervalMinutes = minutes;
  }

  /**
   * Snaps a given Date to the nearest interval.
   */
  snap(date: Date): Date {
    const ms = 1000 * 60 * this.intervalMinutes;
    return new Date(Math.round(date.getTime() / ms) * ms);
  }

  /**
   * Snaps a duration in minutes to the nearest interval.
   */
  snapDuration(durationMinutes: number): number {
    return Math.round(durationMinutes / this.intervalMinutes) * this.intervalMinutes;
  }
}
