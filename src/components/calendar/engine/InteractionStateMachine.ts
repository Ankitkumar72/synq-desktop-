export type InteractionState =
  | 'idle'
  | 'pointerdown'
  | 'dragging'
  | 'resizing'
  | 'autoscrolling'
  | 'dropping'
  | 'committing'
  | 'finished'
  | 'cancelled';

type Listener = (state: InteractionState) => void;

export class InteractionStateMachine {
  private currentState: InteractionState = 'idle';
  private listeners: Set<Listener> = new Set();

  getState(): InteractionState {
    return this.currentState;
  }

  transitionTo(newState: InteractionState) {
    if (this.isValidTransition(this.currentState, newState)) {
      this.currentState = newState;
      this.notify();
    } else {
      console.warn(`[InteractionStateMachine] Invalid transition attempted from ${this.currentState} to ${newState}`);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentState));
  }

  private isValidTransition(from: InteractionState, to: InteractionState): boolean {
    if (from === to) return true;

    switch (from) {
      case 'idle':
        return to === 'pointerdown';
      case 'pointerdown':
        return to === 'dragging' || to === 'resizing' || to === 'cancelled' || to === 'idle';
      case 'dragging':
        return to === 'autoscrolling' || to === 'dropping' || to === 'cancelled';
      case 'resizing':
        return to === 'dropping' || to === 'cancelled';
      case 'autoscrolling':
        return to === 'dragging' || to === 'dropping' || to === 'cancelled';
      case 'dropping':
        return to === 'committing' || to === 'cancelled' || to === 'idle';
      case 'committing':
        return to === 'finished' || to === 'cancelled';
      case 'finished':
      case 'cancelled':
        return to === 'idle';
      default:
        return false;
    }
  }
}
