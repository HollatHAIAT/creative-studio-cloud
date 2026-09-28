import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readText } from "./advisor.functions";

const Diagnosis = z.object({
  summary: z.string().default(""), summaryAr: z.string().default(""),
  problems: z.array(z.object({
    cause: z.string(), causeAr: z.string().default(""),
    likelihood: z.string().default("medium"),
    evidence: z.string().default(""), evidenceAr: z.string().default(""),
    affected: z.string().default(""),
  })).max(8).default([]),
  nextSteps: z.array(z.object({
    step: z.string(), stepAr: z.string().default(""),
    who: z.string().default("moderator"),
  })).max(8).default([]),
  resendAdvice: z.string().default(""), resendAdviceAr: z.string().default(""),
});
export type DeliveryDiagnosis = z.infer<typeof Diagnosis>;

/** Staff only: diagnoses reviewer-invitation email delivery problems from statuses and error messages. */
export const diagnoseInviteDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ report: z.string().trim().min(10).max(8000), context: z.string().trim().max(1000).default("") }).parse(d))
  .handler(async ({ data, context }): Promise<{ diagnosis?: DeliveryDiagnosis; error?: string }> => {
    const { data: staff } = await (context.supabase as any).rpc("is_staff", { _uid: context.userId });
    if (!staff) return { error: "Only moderators and admins can use this." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const prompt = `You help a moderator on Arwiqa (an art marketplace) diagnose why reviewer invitation emails were not delivered.
Platform facts: emails are queued in an outbox with status queued/sending/sent/failed/bounced/cancelled, attempts count and last_error. Staff can resend (max 10). If the site has no verified sender email domain, every email stays "queued" and nothing sends — that's the likely cause when everything is queued. Invitations past their end date can't be resent; the seller must re-invite.
Rules:
- Use ONLY the statuses and error messages given. Don't invent errors. If evidence is thin, say so and set likelihood "low".
- Typical causes: misspelled address/domain (e.g. gmial.com), mailbox full, recipient server rejecting (SPF/DKIM/DMARC), spam filtering, rate limiting, sender domain not set up, invitation expired, repeated failures.
- likelihood: high/medium/low. affected: which emails/rows (mask local part like j***@domain).
- nextSteps: concrete, ordered; who: moderator, seller, reviewer or admin.
- resendAdvice: whether resending now is worth it and why.
- English + natural Arabic for each text field.
MODERATOR CONTEXT: ${JSON.stringify(data.context)}
DELIVERY REPORT: ${JSON.stringify(data.report)}
Reply with ONLY JSON: {"summary":"","summaryAr":"","problems":[{"cause":"","causeAr":"","likelihood":"","evidence":"","evidenceAr":"","affected":""}],"nextSteps":[{"step":"","stepAr":"","who":""}],"resendAdvice":"","resendAdviceAr":""}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error(`Delivery diagnosis AI failed [${res.status}]: ${msg}`);
      if (res.status === 429) return { error: "Too many requests — please try again shortly." };
      if (res.status === 403 && msg.includes("credit_limit")) return { error: "The workspace AI spending limit has been reached. A workspace admin can raise it in workspace settings." };
      if (res.status === 402) return { error: "AI credits are used up for this workspace." };
      return { error: `AI request failed (${res.status}).` };
    }
    let text = "";
    try { text = await readText(res); } catch (e) { return { error: e instanceof Error ? e.message : "AI error" }; }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { error: "The AI returned no diagnosis." };
    try {
      const d = Diagnosis.parse(JSON.parse(json));
      const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      d.problems.sort((a, b) => (rank[a.likelihood] ?? 1) - (rank[b.likelihood] ?? 1));
      return { diagnosis: d };
    } catch { return { error: "The AI returned an unreadable answer." }; }
  });
