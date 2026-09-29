import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

const AnswerRaw = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  summaryIds: z.array(z.string()).default([]),
  entries: z.array(z.object({ ref: z.string().default(""), why: z.string().default(""), whyAr: z.string().default("") })).max(20).default([]),
  patterns: z.array(z.object({ pattern: z.string(), patternAr: z.string().default(""), evidence: z.string().default(""), evidenceAr: z.string().default(""), refs: z.array(z.string()).default([]) })).max(8).default([]),
});
export type AuditAnswer = {
  summary: string; summaryAr: string; summaryIds: string[];
  entries: { id: string; why: string; whyAr: string }[];
  patterns: { pattern: string; patternAr: string; evidence: string; evidenceAr: string; entryIds: string[] }[];
  evidence: Record<string, EvidenceEntry>; searched: number; total: number;
};

/** Admin only: answers a question by searching ALL audit entries (up to 3,000 newest); answers cite entries. */
export const askSettingsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().trim().min(3).max(800) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: AuditAnswer; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const all: any[] = []; let total = 0;
    while (all.length < MAX_REVIEW) {
      const { data: page, error } = await sb.rpc("admin_settings_audit_search", { _from: null, _to: null, _actor: null, _field: null, _limit: Math.min(1000, MAX_REVIEW - all.length), _offset: all.length });
      if (error) return { error: "Couldn't load the change history." };
      if (!page?.length) break;
      total = Number(page[0].total ?? 0); all.push(...page);
      if (all.length >= total) break;
    }
    if (!all.length) return { result: { summary: "There are no recorded setting changes yet.", summaryAr: "لا توجد تغييرات مسجّلة في الإعدادات بعد.", summaryIds: [], entries: [], patterns: [], evidence: {}, searched: 0, total: 0 } };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const byRef = new Map<string, EvidenceEntry>();
    const log = all.map((r, i) => {
      const ref = `e${i + 1}`;
      byRef.set(ref, { id: r.id, n: i + 1, created_at: r.created_at, field: r.field, who: r.actor_email ?? "system", from: r.old_value, to: r.new_value });
      return [ref, r.created_at, r.actor_email ?? "system", r.field, r.old_value, r.new_value];
    });
    const prompt = `You help an admin of Arwiqa (an art marketplace) understand changes to platform settings.
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
Today is ${new Date().toISOString().slice(0, 10)}.
Rules:
- Use ONLY the audit log below. Never invent changes, people or dates. If the log can't answer, say so.
- summary: direct answer to the question; summaryIds: refs it relies on.
- entries: the log rows relevant to the question (most recent first, max 20) by ref, each with a short reason why it's relevant.
- patterns: notable patterns (flip-flops, one admin making most changes, reverts, bursts, large jumps) with evidence text and the refs supporting them. Empty if none.
- Only use ref values that appear in the log (like "e3").
- English + natural Arabic for text fields.
QUESTION: ${JSON.stringify(data.question)}
AUDIT LOG (newest first; ${all.length}${total > all.length ? ` of ${total}` : ""} entries) as [ref, time, admin, setting, old, new]: ${JSON.stringify(log)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","summaryIds":["e1"],"entries":[{"ref":"e1","why":"","whyAr":""}],"patterns":[{"pattern":"","patternAr":"","evidence":"","evidenceAr":"","refs":["e1"]}]}`;
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
    try {
      const r = AnswerRaw.parse(JSON.parse(json));
      const evidence: Record<string, EvidenceEntry> = {};
      const resolve = (refs: string[]) => [...new Set(refs)].map((x) => byRef.get(x)).filter((e): e is EvidenceEntry => !!e).slice(0, 15).map((e) => { evidence[e.id] = e; return e.id; });
      return { result: {
        summary: r.summary, summaryAr: r.summaryAr, summaryIds: resolve(r.summaryIds),
        entries: r.entries.flatMap((e) => { const [id] = resolve([e.ref]); return id ? [{ id, why: e.why, whyAr: e.whyAr }] : []; }),
        patterns: r.patterns.map((p) => ({ pattern: p.pattern, patternAr: p.patternAr, evidence: p.evidence, evidenceAr: p.evidenceAr, entryIds: resolve(p.refs) })),
        evidence, searched: all.length, total: Math.max(total, all.length),
      } };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const Review = z.object({
  overview: z.string().default(""), overviewAr: z.string().default(""),
  findings: z.array(z.object({ title: z.string().default(""), titleAr: z.string().default(""), severity: z.enum(["info", "low", "medium", "high"]).catch("info"), detail: z.string().default(""), detailAr: z.string().default(""), entryIds: z.array(z.string()).default([]) })).max(12).default([]),
  recommendations: z.array(z.object({ text: z.string(), textAr: z.string().default("") })).max(8).default([]),
});
export type EvidenceEntry = { id: string; n: number; created_at: string; field: string; who: string; from: string | null; to: string | null };
export type ComplianceReview = z.infer<typeof Review> & { evidence: Record<string, EvidenceEntry>; reviewed: number; total: number };

const MAX_REVIEW = 3000;

/** Admin only: compliance review of ALL audit entries matching the filters (fetched server-side); every finding cites entries. */
export const reviewSettingsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    actor: z.string().max(320).nullable().default(null),
    field: z.string().max(80).nullable().default(null),
    scope: z.string().max(300).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: ComplianceReview; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const all: any[] = []; let total = 0;
    while (all.length < MAX_REVIEW) {
      const { data: page, error } = await sb.rpc("admin_settings_audit_search", { _from: data.from, _to: data.to, _actor: data.actor, _field: data.field, _limit: Math.min(1000, MAX_REVIEW - all.length), _offset: all.length });
      if (error) return { error: "Couldn't load the change history." };
      if (!page?.length) break;
      total = Number(page[0].total ?? 0); all.push(...page);
      if (all.length >= total) break;
    }
    if (!all.length) return { error: "No entries match these filters." };
    // Short refs keep the prompt compact; mapped back to real entries server-side.
    const byRef = new Map<string, EvidenceEntry>();
    const log = all.map((r, i) => {
      const ref = `e${i + 1}`;
      byRef.set(ref, { id: r.id, n: i + 1, created_at: r.created_at, field: r.field, who: r.actor_email ?? "system", from: r.old_value, to: r.new_value });
      return [ref, r.created_at, r.actor_email ?? "system", r.field, r.old_value, r.new_value];
    });
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You prepare a compliance review of platform-setting changes for Arwiqa (an art marketplace).
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
Rules:
- Use ONLY the entries below. Never invent changes, people or dates.
- overview: scope, period covered, number of changes (${all.length}${total > all.length ? ` reviewed of ${total} matching; only the most recent were included` : ""}), who made them, overall assessment.
- findings: compliance-relevant observations (changes affecting buyer rights like shorter return windows, large price-multiplier jumps, reversals, concentration of changes in one admin, bursts, off-hours or system changes, missing actor). severity info|low|medium|high. entryIds MUST list the exact ref values (like "e3") supporting each finding (at least one, at most 15).
- recommendations: short follow-ups for the reviewer.
- English + natural Arabic for text fields.
SCOPE (admin filters): ${JSON.stringify(data.scope)}
ENTRIES (newest first) as [ref, time, admin, setting, old, new]: ${JSON.stringify(log)}
Reply with ONLY JSON: {"overview":"","overviewAr":"","findings":[{"title":"","titleAr":"","severity":"info","detail":"","detailAr":"","entryIds":["e1"]}],"recommendations":[{"text":"","textAr":""}]}`;
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
      const evidence: Record<string, EvidenceEntry> = {};
      const findings = r.findings.map((f) => {
        const ids = [...new Set(f.entryIds)].map((ref) => byRef.get(ref)).filter((e): e is EvidenceEntry => !!e).slice(0, 15);
        ids.forEach((e) => { evidence[e.id] = e; });
        return { ...f, entryIds: ids.map((e) => e.id) };
      });
      return { result: { ...r, findings, evidence, reviewed: all.length, total: Math.max(total, all.length) } };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });

const ControlRaw = z.object({
  verdict: z.enum(["met", "partially_met", "not_met", "insufficient_evidence"]).catch("insufficient_evidence"),
  summary: z.string().default(""), summaryAr: z.string().default(""),
  assessments: z.array(z.object({ requirement: z.string().default(""), requirementAr: z.string().default(""), status: z.enum(["met", "violated", "unclear"]).catch("unclear"), detail: z.string().default(""), detailAr: z.string().default(""), refs: z.array(z.string()).default([]) })).max(12).default([]),
  gaps: z.array(z.object({ gap: z.string().default(""), gapAr: z.string().default(""), needed: z.string().default(""), neededAr: z.string().default(""), refs: z.array(z.string()).default([]) })).max(10).default([]),
});
export type ControlAssessment = Omit<z.infer<typeof ControlRaw>, "assessments" | "gaps"> & {
  assessments: (Omit<z.infer<typeof ControlRaw>["assessments"][number], "refs"> & { entryIds: string[] })[];
  gaps: (Omit<z.infer<typeof ControlRaw>["gaps"][number], "refs"> & { entryIds: string[] })[];
  evidence: Record<string, EvidenceEntry>; reviewed: number; total: number;
};

/** Admin only: assess ALL audit entries matching the filters against an admin-written control/policy; flags evidence gaps. */
export const assessControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    actor: z.string().max(320).nullable().default(null),
    field: z.string().max(80).nullable().default(null),
    control: z.string().trim().min(10).max(2000),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ result?: ControlAssessment; error?: string }> => {
    const sb = context.supabase as any;
    const { data: admin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) return { error: "Only admins can use this." };
    const all: any[] = []; let total = 0;
    while (all.length < MAX_REVIEW) {
      const { data: page, error } = await sb.rpc("admin_settings_audit_search", { _from: data.from, _to: data.to, _actor: data.actor, _field: data.field, _limit: Math.min(1000, MAX_REVIEW - all.length), _offset: all.length });
      if (error) return { error: "Couldn't load the change history." };
      if (!page?.length) break;
      total = Number(page[0].total ?? 0); all.push(...page);
      if (all.length >= total) break;
    }
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const byRef = new Map<string, EvidenceEntry>();
    const log = all.map((r, i) => {
      const ref = `e${i + 1}`;
      byRef.set(ref, { id: r.id, n: i + 1, created_at: r.created_at, field: r.field, who: r.actor_email ?? "system", from: r.old_value, to: r.new_value });
      return [ref, r.created_at, r.actor_email ?? "system", r.field, r.old_value, r.new_value];
    });
    const prompt = `You are a compliance assessor for Arwiqa (an art marketplace). Assess platform-setting changes against the admin's control/policy.
Settings: return_days (refund window), print_ship_min_days/print_ship_max_days, commercial_print_limit, commercial_multiplier and extended_multiplier (license price × personal).
The log records ONLY: time, admin email, setting, old value, new value. It has NO approvals, tickets, reasons or sign-offs.
Rules:
- Use ONLY the entries below. Never invent changes, approvals or people.
- Split the control into testable requirements; for each: status met|violated|unclear, detail, refs (exact refs like "e3", max 15) proving it.
- gaps: evidence the control needs that this log cannot show (e.g. approvals, second reviewer, justification, notification to buyers), what's needed, and refs of affected entries.
- verdict: met | partially_met | not_met | insufficient_evidence. Prefer insufficient_evidence over guessing.
- ${all.length} entries${total > all.length ? ` (most recent of ${total} matching)` : ""}. English + natural Arabic.
CONTROL: ${JSON.stringify(data.control)}
ENTRIES (newest first) as [ref, time, admin, setting, old, new]: ${JSON.stringify(log)}
Reply with ONLY JSON: {"verdict":"","summary":"","summaryAr":"","assessments":[{"requirement":"","requirementAr":"","status":"unclear","detail":"","detailAr":"","refs":["e1"]}],"gaps":[{"gap":"","gapAr":"","needed":"","neededAr":"","refs":[]}]}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Control assessment AI failed [${res.status}]: ${msg}`);
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
      const r = ControlRaw.parse(JSON.parse(json));
      const evidence: Record<string, EvidenceEntry> = {};
      const resolve = (refs: string[]) => [...new Set(refs)].map((x) => byRef.get(x)).filter((e): e is EvidenceEntry => !!e).slice(0, 15).map((e) => { evidence[e.id] = e; return e.id; });
      return { result: {
        verdict: r.verdict, summary: r.summary, summaryAr: r.summaryAr,
        assessments: r.assessments.map(({ refs, ...a }) => ({ ...a, entryIds: resolve(refs) })),
        gaps: r.gaps.map(({ refs, ...g }) => ({ ...g, entryIds: resolve(refs) })),
        evidence, reviewed: all.length, total: Math.max(total, all.length),
      } };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
