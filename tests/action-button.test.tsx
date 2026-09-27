import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ActionButton, useAction } from "@/components/ActionButton";

function Harness({ fn }: { fn: () => Promise<unknown> }) {
  const a = useAction(fn);
  return <ActionButton state={a.state} onClick={() => void a.run()} onRetry={() => void a.retry()} retryLabel="Try again"
    loadingLabel="Sending…" successLabel="Sent" errorLabel="Failed">Send</ActionButton>;
}

const deferred = () => { let res!: () => void, rej!: (e: Error) => void; const p = new Promise<void>((a, b) => { res = a; rej = b; }); return { p, res, rej }; };

describe("ActionButton", () => {
  it("shows loading, blocks duplicate clicks, then success with an announcement", async () => {
    const d = deferred(); const fn = vi.fn(() => d.p);
    render(<Harness fn={fn} />);
    const btn = screen.getByRole("button", { name: "Send" });
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    await act(async () => { d.res(); await d.p; });
    expect(screen.getByRole("button", { name: /Sent/ })).toBeTruthy();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("Sent");
  });

  it("shows an error alert, focuses retry, and retries once without duplicating", async () => {
    let n = 0; const fn = vi.fn(async () => { if (n++ === 0) throw new Error("x"); });
    render(<Harness fn={fn} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Failed");
    const retry = screen.getByRole("button", { name: /Try again/ });
    expect(document.activeElement).toBe(retry);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: /Sent/ })).toBeTruthy());
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
