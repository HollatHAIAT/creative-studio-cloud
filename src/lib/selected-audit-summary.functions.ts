import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";
import type { EvidenceEntry } from "./settings-audit-qa.functions";

const Raw = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  keyChanges: z.array(z.object({ text: z.string(), textAr: z.string().default(""), refs: z.array(z.string()).default([]) })).max(12).default([]),
  flags: z.array(z.object({ level: z.enum(["low", "medium", "high"]).catch("low"), text: z.string(), textAr: z.string().default(""), refs: z.array(z.string()).default([]) })).max(10).default([]),
});
export type SelectedSummary = {
  summary: string; summaryAr: string;
  keyChanges: { text: string; textAr: string; entryIds: string[] }[];
  flags: { level: "low" | "medium" | "high"; text: string; textAr: string; entryIds: string[] }[];
  evidence: Record<string, EvidenceEntry>; count: number;
};

/** Admin only: summarizes the Change history entries the admin ticked; rows are re-read server-side by id. */
export const summarizeSelectedAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: SelectedSummary; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const want = new Set(data.ids); const found: any[] = [];
    for (let off = 0; found.length < want.size && off < 50000; off += 1000) {
      const { data: page, error } = await sb.rpc("admin_settings_audit_search", { _from: null, _to: null, _actor: null, _field: null, _limit: 1000, _offset: off });
      if (error) return { error: "Couldn't load the change history." };
      if (!page?.length) break;
      for (const r of page) if (want.has(r.id)) found.push(r);
      if (page.length < 1000) break;
    }
    if (!found.length) return { error: "None of the selected entries were found." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    found.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const byRef = new Map<string, EvidenceEntry>();
    const log = found.map((r, i) => {
      const ref = `e${i + 1}`;
      byRef.set(ref, { id: r.id, n: i + 1, created_at: r.created_at, field: r.field, who: r.actor_email ?? "system", from: r.old_value, to: r.new_value });
      return [ref, r.created_at, r.actor_email ?? "system", r.field, r.old_value, r.new_value];
    });
    const prompt = `You help an admin of Arwiqa (an art marketplace) review selected changes to platform settings.
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
Rules:
- Use ONLY the entries below. Never invent changes, people or dates.
- summary: short overview of what changed overall, by whom, over what period.
- keyChanges: the most important changes (net effect per setting, big moves), each citing refs.
- flags: unusual activity — reverts/flip-flops, large jumps, off-hours or bursts of changes, one admin dominating, buyer-unfriendly moves (shorter return window), system changes. level low/medium/high. Empty if nothing unusual.
- Only cite refs that appear below (like "e2"). English + natural Arabic.
ENTRIES (oldest first, UTC) as [ref, time, admin, setting, old, new]: ${JSON.stringify(log)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","keyChanges":[{"text":"","textAr":"","refs":["e1"]}],"flags":[{"level":"low","text":"","textAr":"","refs":["e1"]}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Selected audit AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no answer." };
    try {
      const r = Raw.parse(JSON.parse(json));
      const evidence: Record<string, EvidenceEntry> = {};
      const resolve = (refs: string[]) => [...new Set(refs)].map((x) => byRef.get(x)).filter((e): e is EvidenceEntry => !!e).map((e) => { evidence[e.id] = e; return e.id; });
      return { result: {
        summary: r.summary, summaryAr: r.summaryAr, count: found.length,
        keyChanges: r.keyChanges.map((k) => ({ text: k.text, textAr: k.textAr, entryIds: resolve(k.refs) })),
        flags: r.flags.map((f) => ({ level: f.level, text: f.text, textAr: f.textAr, entryIds: resolve(f.refs) })),
        evidence,
      } };
    } catch { return { error: "The AI answer couldn't be read. Please try again." }; }
  });
