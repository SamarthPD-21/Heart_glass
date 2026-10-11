export type State =
  | 'BOOT'
  | 'LOADING'
  | 'MIRROR'
  | 'ENTERING'
  | 'JOURNEY'
  | 'HEART'
  | 'CUSTOMIZER'
  | 'RECIPIENT';

type Handler = (from: State) => void;

/** Tiny finite-state machine: one current state, enter/exit hooks per state. */
export class FSM {
  state: State = 'BOOT';
  private enter = new Map<State, Handler[]>();
  private exit = new Map<State, Handler[]>();

  onEnter(s: State, fn: Handler) {
    this.enter.set(s, [...(this.enter.get(s) ?? []), fn]);
  }

  onExit(s: State, fn: Handler) {
    this.exit.set(s, [...(this.exit.get(s) ?? []), fn]);
  }

  is(...states: State[]) {
    return states.includes(this.state);
  }

  go(next: State) {
    if (next === this.state) return;
    const prev = this.state;
    this.exit.get(prev)?.forEach((fn) => fn(next));
    this.state = next;
    document.body.dataset.state = next.toLowerCase();
    this.enter.get(next)?.forEach((fn) => fn(prev));
  }
}
