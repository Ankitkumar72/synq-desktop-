/**
 * Hybrid Logical Clock (HLC) Implementation
 * 
 * Used for decentralized conflict resolution (Last Write Wins).
 * Format: ${timestamp}:${counter}:${nodeId}
 * 
 * - timestamp: ISO 8601 or milliseconds (we use milliseconds for compactness)
 * - counter: hex value for events in the same millisecond
 * - nodeId: identifier for the client (e.g. 'web', 'ios', 'android')
 */
export class HLC {
  private lastTimestamp: number = 0;
  private counter: number = 0;
  private nodeId: string = 'web';

  constructor(nodeId: string = 'web') {
    this.nodeId = nodeId;
  }

  /**
   * Generates a new HLC string and increments the internal state.
   */
  increment(): string {
    const now = Date.now();
    
    if (now > this.lastTimestamp) {
      this.lastTimestamp = now;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return this.toString();
  }

  toString(): string {
    // Switching to simple decimal counter to match mobile app expectations (:0:node instead of :0000:node)
    const hlcString = `${this.lastTimestamp}:${this.counter}:${this.nodeId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(globalThis as any).hlc_logged) {
      console.log(`[HLC] Sync initialized: ${this.nodeId} (v2-decimal)`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).hlc_logged = true;
    }
    return hlcString;
  }

  /**
   * Updates the internal clock state based on a received HLC string.
   * Ensures the next generated HLC is greater than any seen before.
   */
  receive(remoteHlc: string): void {
    const [timestampStr, counterStr] = remoteHlc.split(':');
    const remoteTimestamp = parseInt(timestampStr, 10);
    const remoteCounter = parseInt(counterStr, 10);

    const now = Date.now();
    this.lastTimestamp = Math.max(this.lastTimestamp, remoteTimestamp, now);
    
    if (this.lastTimestamp === remoteTimestamp) {
      this.counter = Math.max(this.counter, remoteCounter) + 1;
    } else if (this.lastTimestamp === now) {
      this.counter = 0;
    }
  }

  /**
   * Returns a static HLC string for the current moment without incrementing internal state.
   */
  now(): string {
    return `${Date.now()}:0:${this.nodeId}`;
  }

  /**
   * Compare two HLC strings to determine which is newer.
   * Returns > 0 if a is newer, < 0 if b is newer, 0 if equal.
   */
  static compare(a: string, b: string): number {
    if (a === b) return 0;
    
    const [aTime, aCounter] = a.split(':');
    const [bTime, bCounter] = b.split(':');
    
    const timeDiff = parseInt(aTime, 10) - parseInt(bTime, 10);
    if (timeDiff !== 0) return timeDiff;
    
    return parseInt(aCounter, 10) - parseInt(bCounter, 10);
  }
}

// Global instance for convenience
export const hlc = new HLC('web');
