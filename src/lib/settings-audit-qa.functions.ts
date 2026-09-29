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

const Review = z.object({
  overview: z.string().default(""), overviewAr: z.string().default(""),
  findings: z.array(z.object({ title: z.string().default(""), titleAr: z.string().default(""), severity: z.enum(["info", "low", "medium", "high"]).catch("info"), detail: z.string().default(""), detailAr: z.string().default(""), entryIds: z.array(z.string()).default([]) })).max(12).default([]),
  recommendations: z.array(z.object({ text: z.string(), textAr: z.string().default("") })).max(8).default([]),
});
export type ComplianceReview = z.infer<typeof Review>;

/** Admin only: compliance review of a chosen set of audit entries, every finding cites entry IDs. */
export const reviewSettingsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(300), scope: z.string().max(300).default("") }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: ComplianceReview; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const { data: rows, error } = await sb.rpc("admin_settings_audit", { _limit: 1000 });
    if (error) return { error: "Couldn't load the change history." };
    const want = new Set(data.ids);
    const log = (rows ?? []).filter((r: any) => want.has(r.id)).map((r: any) => ({ id: r.id, when: r.created_at, who: r.actor_email ?? "system", field: r.field, from: r.old_value, to: r.new_value }));
    if (!log.length) return { error: "None of the selected entries were found." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You prepare a compliance review of platform-setting changes for Arwiqa (an art marketplace).
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
Rules:
- Use ONLY the entries below. Never invent changes, people or dates.
- overview: scope, period covered, number of changes, who made them, overall assessment.
- findings: compliance-relevant observations (changes affecting buyer rights like shorter return windows, large price-multiplier jumps, reversals, concentration of changes in one admin, bursts, off-hours or system changes, missing actor). severity info|low|medium|high. entryIds MUST list the exact "id" values supporting each finding (at least one).
- recommendations: short follow-ups for the reviewer.
- English + natural Arabic for text fields.
SCOPE (admin filters): ${JSON.stringify(data.scope)}
ENTRIES: ${JSON.stringify(log)}
Reply with ONLY JSON: {"overview":"","overviewAr":"","findings":[{"title":"","titleAr":"","severity":"info","detail":"","detailAr":"","entryIds":[""]}],"recommendations":[{"text":"","textAr":""}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Compliance review AI failed [${res.status}]: ${msg}`);
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
      const r = Review.parse(JSON.parse(json));
      const valid = new Set(log.map((l: any) => l.id));
      r.findings = r.findings.map((f) => ({ ...f, entryIds: f.entryIds.filter((id) => valid.has(id)) }));
      return { result: r };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
