import { EventRect } from '../types';

export class LayoutCache {
  private cache = new Map<string, EventRect[]>();
  private dirtyKeys = new Set<string>();

  /**
   * Generates a date-string key (YYYY-MM-DD) for grouping layouts by day.
   */
  getCacheKey(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  /**
   * Retrieves cached coordinate rects if they exist and are not marked dirty.
   */
  get(date: Date): EventRect[] | null {
    const key = this.getCacheKey(date);
    if (this.dirtyKeys.has(key)) {
      return null;
    }
    return this.cache.get(key) || null;
  }

  /**
   * Caches coordinate rects for a given day.
   */
  set(date: Date, rects: EventRect[]) {
    const key = this.getCacheKey(date);
    this.cache.set(key, rects);
    this.dirtyKeys.delete(key);
  }

  /**
   * Invalidates/marks cached data dirty for a specific day.
   */
  invalidate(date: Date) {
    const key = this.getCacheKey(date);
    this.dirtyKeys.add(key);
  }

  /**
   * Clears the layout cache completely.
   */
  clear() {
    this.cache.clear();
    this.dirtyKeys.clear();
  }
}
