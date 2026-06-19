let memoryNodeId: string | null = null

function getTabNodeId(): string {
  if (typeof window === 'undefined') return 'server'

  if (!memoryNodeId) {
    // Generate a unique ID: 'web-XXXX' where XXXX is a random hex
    // Using memory-only ensures duplicated tabs get unique IDs, preventing CRDT and sync loops.
    memoryNodeId = `web-${Math.random().toString(16).slice(2, 6)}`
  }

  return memoryNodeId
}

export class HLC {
  private lastTimestamp: number = 0;
  private counter: number = 0;
  private nodeId: string;

  constructor(nodeId?: string) {
    this.nodeId = nodeId ?? getTabNodeId();
  }

  /**
   * Get the node ID for this clock instance.
   */
  getNodeId(): string {
    return this.nodeId;
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

    if (!(globalThis as any).hlc_logged) {
      console.log(`[HLC] Sync initialized: ${this.nodeId} (v2-decimal)`);

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

    const [aTime, aCounter, aNode] = a.split(':');
    const [bTime, bCounter, bNode] = b.split(':');

    const timeDiff = parseInt(aTime, 10) - parseInt(bTime, 10);
    if (timeDiff !== 0) return timeDiff;

    const counterDiff = parseInt(aCounter, 10) - parseInt(bCounter, 10);
    if (counterDiff !== 0) return counterDiff;

    // Deterministic tie-break: higher node ID wins (lexicographic)
    if (aNode && bNode) return aNode.localeCompare(bNode);

    return 0;
  }

  /**
   * Extract the node ID from an HLC string.
   */
  static extractNodeId(hlcString: string): string {
    const parts = hlcString.split(':');
    return parts[2] || 'unknown';
  }
}

// Global instance — uses a unique per-tab node ID
export const hlc = new HLC();
