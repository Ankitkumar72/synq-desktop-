export class CoordinateMapper {
  private hourHeight: number;
  private columnWidth: number;
  private baseDate: Date; // e.g. start of week or start of day

  constructor(options: { hourHeight?: number; columnWidth?: number; baseDate?: Date } = {}) {
    this.hourHeight = options.hourHeight || 80;
    this.columnWidth = options.columnWidth || 100;
    this.baseDate = options.baseDate || new Date();
  }

  setHourHeight(height: number) {
    this.hourHeight = height;
  }

  setColumnWidth(width: number) {
    this.columnWidth = width;
  }

  setBaseDate(date: Date) {
    this.baseDate = date;
  }

  /**
   * Converts a Y pixel coordinate to a Date (relative to midnight of the mapped day).
   * Note: This returns the time component for a generic day.
   * To get the exact date, combine this with the date from pixelToDay.
   */
  pixelToTime(y: number): Date {
    const hours = y / this.hourHeight;
    const date = new Date(this.baseDate);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(hours * 60);
    return date;
  }

  /**
   * Converts a Date to a Y pixel coordinate (based on its time component).
   */
  timeToPixel(date: Date): number {
    const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    return (minutesSinceMidnight / 60) * this.hourHeight;
  }

  /**
   * Converts an X pixel coordinate to a day offset.
   */
  pixelToDayOffset(x: number): number {
    return Math.floor(x / this.columnWidth);
  }

  /**
   * Converts a day offset to an X pixel coordinate.
   */
  dayOffsetToPixel(offset: number): number {
    return offset * this.columnWidth;
  }
}
