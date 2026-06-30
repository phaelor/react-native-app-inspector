import type { TimelineSeverity } from '../../core/types';

/** A captured error / console event. */
export interface ErrorEntry {
  message: string;
  severity: TimelineSeverity;
  /** Where it came from. */
  source: 'uncaught' | 'console.error' | 'console.warn';
  fatal?: boolean;
}

export interface ErrorTrackerOptions {
  onEntry: (entry: ErrorEntry) => void;
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
}

type ConsoleMethod = (...args: unknown[]) => void;

function stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) {
        return a.message;
      }
      return typeof a === 'object' ? safeJson(a) : String(a);
    })
    .join(' ');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Captures uncaught JS errors (via `ErrorUtils`) and `console.error` /
 * `console.warn`, routing each to the timeline. Patching is reversible.
 */
export class ErrorTracker {
  private readonly onEntry: (entry: ErrorEntry) => void;
  private running = false;
  private previousHandler: GlobalErrorHandler | null = null;
  private originalError: ConsoleMethod | null = null;
  private originalWarn: ConsoleMethod | null = null;

  constructor(options: ErrorTrackerOptions) {
    this.onEntry = options.onEntry;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.patchGlobalHandler();
    this.patchConsole();
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike })
      .ErrorUtils;
    if (this.previousHandler && errorUtils?.setGlobalHandler) {
      errorUtils.setGlobalHandler(this.previousHandler);
    }
    if (this.originalError) {
      console.error = this.originalError;
    }
    if (this.originalWarn) {
      console.warn = this.originalWarn;
    }
    this.previousHandler = null;
    this.originalError = null;
    this.originalWarn = null;
    this.running = false;
  }

  private patchGlobalHandler(): void {
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike })
      .ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) {
      return;
    }
    this.previousHandler = errorUtils.getGlobalHandler();
    const previous = this.previousHandler;
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      const message = error instanceof Error ? error.message : String(error);
      this.onEntry({
        message,
        severity: 'error',
        source: 'uncaught',
        fatal: isFatal,
      });
      previous?.(error, isFatal);
    });
  }

  private patchConsole(): void {
    this.originalError = console.error;
    this.originalWarn = console.warn;
    const originalError = this.originalError;
    const originalWarn = this.originalWarn;

    console.error = (...args: unknown[]) => {
      this.onEntry({
        message: stringify(args),
        severity: 'error',
        source: 'console.error',
      });
      originalError.apply(console, args);
    };
    console.warn = (...args: unknown[]) => {
      this.onEntry({
        message: stringify(args),
        severity: 'warn',
        source: 'console.warn',
      });
      originalWarn.apply(console, args);
    };
  }
}
