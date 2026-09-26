// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const log: string[] = [];
let n = 0;
const fake = {
  channel: (name: string) => {
    const id = ++n; let subscribed = false;
    log.push(`create:${id}`);
    const ch = {
      name,
      on: () => { if (subscribed) throw new Error("cannot add postgres_changes callbacks after subscribe()"); log.push(`on:${id}`); return ch; },
      subscribe: () => { subscribed = true; log.push(`sub:${id}`); return ch; },
      id,
    };
    return ch;
  },
  removeChannel: (c: { id: number }) => { log.push(`remove:${c.id}`); },
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: fake }));

describe("bids-live channel lifecycle", () => {
  it("handlers attach before subscribe, one live channel under Strict Mode, removed on cleanup", async () => {
    const { BidsLiveProvider } = await import("../src/components/BidsLiveProvider");
    const qc = new QueryClient();
    const r = render(<StrictMode><QueryClientProvider client={qc}><BidsLiveProvider /></QueryClientProvider></StrictMode>);
    for (let i = 1; i <= n; i++) expect(log.indexOf(`on:${i}`)).toBeLessThan(log.indexOf(`sub:${i}`));
    const live = () => Array.from({ length: n }, (_, i) => i + 1).filter((i) => !log.includes(`remove:${i}`));
    expect(live()).toHaveLength(1);
    r.unmount();
    expect(live()).toHaveLength(0);
  });
});
