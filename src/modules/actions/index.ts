import type { ActionLogEntry } from '../../core/types';

export interface ActionLoggerOptions {
  /** Called for every recorded action. */
  onEntry: (entry: ActionLogEntry) => void;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `act_${Date.now()}_${seq}`;
}

/** Shape of a Redux-style action (only `type` is required). */
interface ReduxAction {
  type: string;
  [key: string]: unknown;
}

/**
 * Records app/state actions — Redux dispatches, navigation events or custom
 * domain events. The owner (the controller) provides an `onEntry` sink so the
 * entry lands in the shared store and on the timeline.
 */
export class ActionLogger {
  private readonly onEntry: (entry: ActionLogEntry) => void;

  constructor(options: ActionLoggerOptions) {
    this.onEntry = options.onEntry;
  }

  /** Record an action by type and optional payload. */
  log(type: string, payload?: unknown): void {
    this.onEntry({
      id: nextId(),
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * A Redux middleware that logs every dispatched action. Drop it into your
   * store: `applyMiddleware(AppInspector.getActionLogger().middleware())`.
   */
  middleware() {
    const log = this.log.bind(this);
    return (_store: unknown) =>
      (next: (action: ReduxAction) => unknown) =>
      (action: ReduxAction) => {
        if (action && typeof action.type === 'string') {
          log(action.type, action);
        }
        return next(action);
      };
  }
}
