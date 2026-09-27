import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";

export type ActionState = "idle" | "loading" | "success" | "error";

/**
 * Runs an async action at most once at a time (re-entry is ignored, so double clicks
 * never create duplicate operations). Inputs are never cleared on failure, so retry is safe.
 */
export function useAction<A extends unknown[]>(fn: (...a: A) => Promise<unknown>, opts: { resetMs?: number } = {}) {
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<unknown>(null);
  const running = useRef(false);
  const last = useRef<A | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const run = async (...a: A) => {
    if (running.current) return false;
    running.current = true; last.current = a;
    setState("loading"); setError(null);
    try {
      await fn(...a);
      setState("success");
      timer.current = setTimeout(() => setState("idle"), opts.resetMs ?? 2500);
      return true;
    } catch (e) { setError(e); setState("error"); return false; }
    finally { running.current = false; }
  };
  const retry = () => (last.current ? run(...last.current) : Promise.resolve(false));
  return { state, error, run, retry, busy: state === "loading" };
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  state: ActionState; children: ReactNode;
  loadingLabel: string; successLabel: string; errorLabel: string;
  onRetry?: () => void; retryLabel?: string;
};

/** Button that shows loading / success / error and announces changes to screen readers. */
export function ActionButton({ state, children, loadingLabel, successLabel, errorLabel, onRetry, retryLabel, className = "", disabled, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Keep focus somewhere meaningful: on error move it to "Try again".
  useEffect(() => { if (state === "error" && onRetry) retryRef.current?.focus(); }, [state, onRetry]);
  const msg = state === "loading" ? loadingLabel : state === "success" ? successLabel : state === "error" ? errorLabel : "";
  return (
    <span className="inline-flex flex-col gap-1">
      <button ref={ref} {...rest} disabled={disabled || state === "loading"} aria-busy={state === "loading"} data-state={state}
        className={`inline-flex items-center justify-center gap-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`}>
        {state === "loading" && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
        {state === "success" && <Check aria-hidden className="h-4 w-4" />}
        <span className="inline-flex items-center gap-2">{state === "loading" ? loadingLabel : state === "success" ? successLabel : children}</span>
      </button>
      {state === "error" && (
        <span role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {errorLabel}
          {onRetry && <button ref={retryRef} type="button" onClick={onRetry} className="inline-flex items-center gap-1 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><RotateCcw aria-hidden className="h-3 w-3" />{retryLabel ?? "Try again"}</button>}
        </span>
      )}
      <span className="sr-only" aria-live="polite">{state === "error" ? "" : msg}</span>
    </span>
  );
}
