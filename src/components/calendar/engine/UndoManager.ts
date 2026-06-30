import { CalendarTransaction } from '../types';

export class UndoManager {
  private stack: CalendarTransaction[] = [];
  private index: number = -1;

  /**
   * Pushes a new transaction onto the undo stack.
   * Clears any available redo history.
   */
  push(transaction: CalendarTransaction) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(transaction);
    this.index++;
  }

  /**
   * Undoes the last transaction and returns it (so the caller can apply the 'before' state).
   */
  undo(): CalendarTransaction | null {
    if (this.index < 0) return null;
    const tx = this.stack[this.index];
    this.index--;
    return tx;
  }

  /**
   * Redoes the next transaction and returns it (so the caller can apply the 'after' state).
   */
  redo(): CalendarTransaction | null {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    const tx = this.stack[this.index];
    return tx;
  }

  canUndo(): boolean {
    return this.index >= 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }
}
