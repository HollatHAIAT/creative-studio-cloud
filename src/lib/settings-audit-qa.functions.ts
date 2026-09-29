import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

const Answer = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  entries: z.array(z.object({ when: z.string().default(""), who: z.string().default(""), field: z.string().default(""), change: z.string().default(""), changeAr: z.string().default("") })).max(20).default([]),
  patterns: z.array(z.object({ pattern: z.string(), patternAr: z.string().default(""), evidence: z.string().default(""), evidenceAr: z.string().default("") })).max(8).default([]),
});
export type AuditAnswer = z.infer<typeof Answer>;

/** Admin only: answers a question about platform-setting changes from the audit log. */
export const askSettingsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().trim().min(3).max(800) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: AuditAnswer; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const { data: rows, error } = await sb.rpc("admin_settings_audit", { _limit: 300 });
    if (error) return { error: "Couldn't load the change history." };
    if (!rows?.length) return { result: { summary: "There are no recorded setting changes yet.", summaryAr: "لا توجد تغييرات مسجّلة في الإعدادات بعد.", entries: [], patterns: [] } };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const log = rows.map((r: any) => ({ when: r.created_at, who: r.actor_email ?? "system", field: r.field, from: r.old_value, to: r.new_value }));
    const prompt = `You help an admin of Arwiqa (an art marketplace) understand changes to platform settings.
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
Rules:
- Use ONLY the audit log below. Never invent changes, people or dates. If the log can't answer, say so.
- summary: direct answer to the question.
- entries: the log rows relevant to the question (most recent first, max 20); change like "14 → 21".
- patterns: notable patterns (frequent flip-flops, one admin making most changes, changes reverted soon after, bursts of changes, unusually large jumps). Each with evidence from the log. Empty if none.
- English + natural Arabic for text fields.
QUESTION: ${JSON.stringify(data.question)}
AUDIT LOG (newest first): ${JSON.stringify(log)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","entries":[{"when":"","who":"","field":"","change":"","changeAr":""}],"patterns":[{"pattern":"","patternAr":"","evidence":"","evidenceAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Settings audit AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no answer." };
    try { return { result: Answer.parse(JSON.parse(json)) }; } catch { return { error: "The AI returned an unreadable answer." }; }
  });
