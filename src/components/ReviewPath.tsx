import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { toast } from "sonner";

// Loose client: these tables were added recently.
const sb = supabase as any;

export type ReviewMode = "direct" | "self" | "team" | "external" | "curator" | "gallery" | "ai" | "ai_team" | "platform";
export const CATEGORIES = ["Painting", "Photography", "Calligraphy", "Sadu", "Qatt", "Pottery", "Illustration", "Digital", "Print", "Heritage"];

const MODES: { id: ReviewMode; en: string; ar: string; hint: [string, string] }[] = [
  { id: "direct", en: "Publish directly", ar: "انشر مباشرة", hint: ["No reviewers. Platform checks still run.", "بلا مراجعين، مع بقاء فحوص المنصة."] },
  { id: "self", en: "Review it myself", ar: "أراجعه بنفسي", hint: ["Private notes, then publish.", "ملاحظات خاصة ثم النشر."] },
  { id: "team", en: "Review with my team", ar: "مراجعة مع فريقي", hint: ["Invite studio members.", "ادعُ أعضاء مرسمك."] },
  { id: "external", en: "Invite specific reviewers", ar: "دعوة مراجعين محددين", hint: ["People outside your team, time-limited.", "أشخاص من خارج فريقك بمدة محددة."] },
  { id: "curator", en: "Ask a curator", ar: "اطلب قيّماً فنياً", hint: ["A curator comments and recommends.", "يعلّق القيّم ويوصي."] },
  { id: "gallery", en: "Submit to gallery review", ar: "مراجعة الغاليري", hint: ["Your gallery reviews first.", "يراجعه الغاليري أولاً."] },
  { id: "ai", en: "AI review only", ar: "مراجعة ذكية فقط", hint: ["Use the AI checks in this page.", "استخدم الفحوص الذكية في هذه الصفحة."] },
  { id: "ai_team", en: "AI + team review", ar: "ذكاء اصطناعي + الفريق", hint: ["AI checks plus invited people.", "فحوص ذكية مع مدعوين."] },
  { id: "platform", en: "Platform review", ar: "مراجعة المنصة", hint: ["Arwiqa staff approve before it goes live.", "يعتمده فريق أروقة قبل النشر."] },
];
const INVITES: ReviewMode[] = ["team", "external", "curator", "gallery", "ai_team"];

const ISSUE: Record<string, [string, string]> = {
  account_suspended: ["Your account is suspended", "حسابك موقوف"],
  ownership_not_declared: ["Confirm you own or may sell this work", "أكّد ملكيتك أو صلاحيتك للبيع"],
  price: ["Set a price", "حدّد السعر"],
  category: ["Choose a category", "اختر التصنيف"],
  policy_direct_disabled: ["Direct publishing is turned off by Arwiqa right now", "النشر المباشر موقوف حالياً من أروقة"],
  policy_category_needs_review: ["This category always needs platform review", "هذا التصنيف يتطلب مراجعة المنصة دائماً"],
  owner_details: ["Add the owner's name and email", "أضف اسم المالك وبريده"],
  owner_approval: ["Waiting for the owner to approve", "بانتظار موافقة المالك"],
  consignment_terms: ["Add the consignment terms", "أضف شروط الأمانة"],
  heritage_type: ["Choose the heritage type", "اختر نوع القطعة التراثية"],
  heritage_origin: ["Add the region of origin and era", "أضف منطقة المنشأ والحقبة"],
  provenance: ["Add at least one ownership history entry", "أضف مرحلة واحدة على الأقل من سجل الملكية"],
  condition_report: ["Add a condition grade and report", "أضف تقييم الحالة وتقريرها"],
  policy_price_needs_review: ["Works above the price limit need platform review", "الأعمال فوق حد السعر تتطلب مراجعة المنصة"],
};

type Reviewer = { status?: string; id: string; email: string; role: string; permission: string; starts_at: string; expires_at: string | null; allow_download: boolean; watermark: boolean };
type Comment = { id: string; body: string; visibility: string; score: number | null; recommendation: string | null; created_at: string; author: string };

export function ReviewPath({ draftId, onSave, onPublished, submitted }: {
  draftId: string | null; onSave: () => Promise<string | null>; onPublished: (listingId: string) => void; submitted: boolean;
}) {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [mode, setMode] = useState<ReviewMode>("platform");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState(false);
  const [issues, setIssues] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setIssues(null); setDone(null);
    if (!draftId) return;
    void sb.from("listing_drafts").select("review_mode, price, category, owner_declared, status, published_listing_id").eq("id", draftId).single()
      .then(({ data }: any) => {
        if (!data) return;
        setMode(data.review_mode); setPrice(data.price ? String(data.price) : ""); setCategory(data.category ?? ""); setOwner(data.owner_declared);
        if (data.status === "published") setDone(data.published_listing_id);
      });
  }, [draftId]);

  const persist = async (): Promise<string | null> => {
    const id = draftId ?? (await onSave());
    if (!id) return null;
    const { error } = await sb.from("listing_drafts").update({ review_mode: mode, price: price ? Number(price) : null, category: category || null, owner_declared: owner }).eq("id", id);
    if (error) { toast.error(L("Couldn't save your choices.", "تعذّر حفظ اختياراتك.")); return null; }
    return id;
  };

  const check = async () => {
    setBusy(true);
    const id = await persist();
    if (id) { const { data } = await sb.rpc("platform_validation_issues", { _id: id }); setIssues(data ?? []); }
    setBusy(false);
  };

  const publishNow = async () => {
    setBusy(true);
    const id = await persist();
    if (!id) { setBusy(false); return; }
    const { data, error } = await sb.rpc("seller_publish_direct", { _id: id });
    setBusy(false);
    if (error) {
      const list = error.message.match(/checks failed: (.+)/)?.[1]?.split(",") ?? [];
      setIssues(list.length ? list : ["unknown"]);
      toast.error(L("Not published — see what to fix.", "لم يُنشر — راجع ما يلزم إصلاحه."));
      return;
    }
    setDone(data); onPublished(data);
    toast.success(L("Your listing is live in the shop", "إعلانك منشور الآن في المتجر"));
  };

  const cur = MODES.find((m) => m.id === mode)!;
  const policyBlocks = issues?.some((i) => i.startsWith("policy_"));
  const label = (i: string) => ISSUE[i] ? L(ISSUE[i][0], ISSUE[i][1]) : L(`Fix: ${i}`, `أصلح: ${i}`);

  return (
    <section aria-labelledby="review-path-h" className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
      <div>
        <h2 id="review-path-h" className="font-display text-lg">{L("How would you like to prepare this artwork?", "كيف تودّ تجهيز هذا العمل؟")}</h2>
        <p className="text-muted-foreground">{L("Review is optional. Basic platform checks always run, but they aren't a creative review.", "المراجعة اختيارية. فحوص المنصة الأساسية تعمل دائماً، وليست مراجعة فنية.")}</p>
      </div>
      <fieldset disabled={!!done || submitted} className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">{L("Review mode", "طريقة المراجعة")}</legend>
        {MODES.map((m) => (
          <label key={m.id} className={`cursor-pointer rounded-xl border p-3 transition ${mode === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <input type="radio" name="review-mode" value={m.id} checked={mode === m.id} onChange={() => { setMode(m.id); setIssues(null); }} className="sr-only" />
            <span className="block font-medium">{L(m.en, m.ar)}</span>
            <span className="block text-xs text-muted-foreground">{L(m.hint[0], m.hint[1])}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1"><span className="block text-xs text-muted-foreground">{L("Price (USD)", "السعر (دولار)")}</span>
          <input id="f-price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} disabled={!!done} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
        <label className="space-y-1"><span className="block text-xs text-muted-foreground">{L("Category", "التصنيف")}</span>
          <select id="f-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!done} className="w-full rounded-lg border border-input bg-background px-3 py-2">
            <option value="">{L("Choose…", "اختر…")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} disabled={!!done} />
          <span>{L("I own this work or am authorised to sell it", "أملك هذا العمل أو مخوّل ببيعه")}</span></label>
      </div>

      {done ? (
        <p role="status" className="rounded-xl bg-success/10 p-3 text-success">{L("Published directly.", "نُشر مباشرة.")} <a className="underline" href={`/listing/${done}`}>{L("View in shop", "اعرضه في المتجر")}</a></p>
      ) : mode === "platform" ? (
        <p className="text-muted-foreground">{L("Use “Publish listing” below to send it to Arwiqa staff.", "استخدم «انشر الإعلان» أدناه لإرساله لفريق أروقة.")}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={check} disabled={busy} className="rounded-full border border-border px-4 py-2">{L("Run platform checks", "شغّل فحوص المنصة")}</button>
            <button type="button" onClick={publishNow} disabled={busy} className="rounded-full bg-primary px-5 py-2 text-primary-foreground">
              {busy ? L("Working…", "جارٍ العمل…") : mode === "direct" ? L("Publish now", "انشر الآن") : L("Finish review & publish", "أنهِ المراجعة وانشر")}
            </button>
          </div>
          {issues && (
            <div aria-live="polite">
              {issues.length === 0 ? <p className="text-success">{L("All platform checks pass.", "اجتازت جميع فحوص المنصة.")}</p> : (
                <ul className="list-disc space-y-1 ps-5 text-destructive">{issues.map((i) => <li key={i}>{label(i)}</li>)}</ul>
              )}
              {policyBlocks && <p className="mt-1 text-muted-foreground">{L("Switch to Platform review to send it to staff instead.", "اختر مراجعة المنصة لإرساله للفريق بدلاً من ذلك.")}</p>}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{L(cur.hint[0], cur.hint[1])}</p>

      {draftId && (INVITES.includes(mode) || mode === "self") && !done && <Collaborators draftId={draftId} invite={INVITES.includes(mode)} mode={mode} />}
    </section>
  );
}

function Collaborators({ draftId, invite, mode }: { draftId: string; invite: boolean; mode: ReviewMode }) {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [list, setList] = useState<Reviewer[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [email, setEmail] = useState(""); const [perm, setPerm] = useState("comment");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [dl, setDl] = useState(false); const [wm, setWm] = useState(true);
  const [body, setBody] = useState(""); const [vis, setVis] = useState(mode === "self" ? "private" : "reviewers");
  const role = mode === "curator" ? "curator" : mode === "gallery" ? "gallery" : mode === "team" ? "team" : "external";

  const load = async () => {
    const [r, c] = await Promise.all([
      sb.from("listing_reviewers").select("*").eq("draft_id", draftId).order("created_at"),
      sb.from("listing_review_comments").select("*").eq("draft_id", draftId).order("created_at"),
    ]);
    setList(r.data ?? []); setComments(c.data ?? []);
  };
  useEffect(() => { void load(); }, [draftId]);

  const add = async () => {
    if (!email.includes("@")) { toast.error(L("Enter an email", "أدخل بريداً")); return; }
    if (end && start && new Date(end) <= new Date(start)) { toast.error(L("End must be after start", "النهاية بعد البداية")); return; }
    const { error } = await sb.from("listing_reviewers").insert({ draft_id: draftId, email: email.trim().toLowerCase(), role, permission: perm,
      starts_at: start ? new Date(start).toISOString() : new Date().toISOString(), expires_at: end ? new Date(end).toISOString() : null, allow_download: dl, watermark: wm });
    if (error) { toast.error(L("Couldn't invite (already invited?)", "تعذّرت الدعوة (مدعو مسبقاً؟)")); return; }
    setEmail(""); void load();
  };
  const remove = async (id: string) => { await sb.from("listing_reviewers").delete().eq("id", id); void load(); };
  const post = async () => {
    if (!body.trim()) return;
    const { error } = await sb.from("listing_review_comments").insert({ draft_id: draftId, body: body.trim(), visibility: vis });
    if (error) { toast.error(L("Couldn't post", "تعذّر النشر")); return; }
    setBody(""); void load();
  };
  const permL: Record<string, [string, string]> = { view: ["View only", "مشاهدة فقط"], comment: ["Comment", "تعليق"], score: ["Comment + score", "تعليق وتقييم"], recommend: ["Score + recommend", "تقييم وتوصية"] };
  const visL: Record<string, [string, string]> = { private: ["Only me", "لي فقط"], team: ["Team", "الفريق"], reviewers: ["Reviewers", "المراجعون"], artist: ["Artist-visible", "يراه الفنان"], anonymous: ["Anonymous jury", "لجنة مجهولة"], internal: ["Arwiqa staff", "فريق أروقة"] };

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {invite && (
        <div className="space-y-2">
          <h3 className="font-medium">{L("Reviewers", "المراجعون")}</h3>
          <div className="grid gap-2 sm:grid-cols-6">
            <input aria-label={L("Reviewer email", "بريد المراجع")} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 sm:col-span-2" />
            <select aria-label={L("Permission", "الصلاحية")} value={perm} onChange={(e) => setPerm(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2">
              {Object.entries(permL).map(([k, v]) => <option key={k} value={k}>{L(v[0], v[1])}</option>)}
            </select>
            <input aria-label={L("Starts", "يبدأ")} type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2" />
            <input aria-label={L("Expires", "ينتهي")} type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2" />
            <button type="button" onClick={add} className="rounded-full bg-primary px-4 py-2 text-primary-foreground">{L("Invite", "ادعُ")}</button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={dl} onChange={(e) => setDl(e.target.checked)} />{L("Allow download", "السماح بالتنزيل")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={wm} onChange={(e) => setWm(e.target.checked)} />{L("Watermarked preview", "معاينة بعلامة مائية")}</label>
          </div>
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{r.email} · {r.expires_at && new Date(r.expires_at) <= new Date() ? L("Expired", "منتهية") : r.status === "accepted" ? L("Accepted", "مقبولة") : r.status === "declined" ? L("Declined", "مرفوضة") : L("Pending", "بانتظار الرد")} · {L((permL[r.permission] ?? ["",""])[0], (permL[r.permission] ?? ["",""])[1])} · {new Date(r.starts_at).toLocaleDateString()}{r.expires_at ? ` → ${new Date(r.expires_at).toLocaleDateString()}` : ""}{r.watermark ? " · 💧" : ""}{r.allow_download ? " · ⬇" : ""}</span>
                <button type="button" onClick={() => remove(r.id)} className="text-xs text-destructive underline">{L("Remove", "إزالة")}</button>
              </li>
            ))}
            {!list.length && <li className="py-2 text-muted-foreground">{L("No reviewers yet.", "لا مراجعين بعد.")}</li>}
          </ul>
          <p className="text-xs text-muted-foreground">{L("Reviewers sign in with the invited email and find it under “Review invitations”. They can't sell or manage the listing.", "يدخل المراجع بالبريد المدعو ويجدها في «دعوات المراجعة». لا يستطيع البيع أو إدارة الإعلان.")}</p>
        </div>
      )}
      <ChecklistProgress draftId={draftId} canEdit />
      <div className="space-y-2">
        <h3 className="font-medium">{L("Comments", "التعليقات")}</h3>
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">{L((visL[c.visibility] ?? ["",""])[0], (visL[c.visibility] ?? ["",""])[1])} · {new Date(c.created_at).toLocaleString()}{c.score ? ` · ★${c.score}` : ""}{c.recommendation ? ` · ${c.recommendation}` : ""}</span>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <textarea aria-label={L("Comment", "تعليق")} value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2" />
          <select aria-label={L("Who can see it", "من يراه")} value={vis} onChange={(e) => setVis(e.target.value)} className="rounded-lg border border-input bg-background px-2">
            {["private", "team", "reviewers"].map((k) => <option key={k} value={k}>{L((visL[k] ?? ["",""])[0], (visL[k] ?? ["",""])[1])}</option>)}
          </select>
          <button type="button" onClick={post} className="rounded-full border border-border px-4">{L("Post", "أرسل")}</button>
        </div>
      </div>
    </div>
  );
}
