import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { ActionButton, useAction } from "@/components/ActionButton";
import { RevisionGuidance } from "@/components/RevisionGuidance";
import { ListingVersionHistory } from "@/components/ListingVersionHistory";
import { EvidenceCheck } from "@/components/EvidenceCheck";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { categories } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/listings")({
  head: () => ({ meta: [
    { title: "Listing review dashboard — Arwiqa أروقة" },
    { name: "description", content: "Staff dashboard to inspect, approve or reject submitted artwork listings." },
    { property: "og:title", content: "Listing review dashboard — Arwiqa" },
    { property: "og:description", content: "Approve or reject submitted listings and track their publishing status." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  // Moderators and admins only; everyone else is sent to their account page before the page renders.
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: ok } = u.user ? await (supabase as any).rpc("can_view_private_comments", { _uid: u.user.id }) : { data: false };
    if (!ok) {
      const { toast } = await import("sonner");
      toast.error(document.documentElement.lang === "ar" ? "صفحة مراجعة الإعلانات للمشرفين والمديرين فقط." : "Listing review is only for moderators and admins.");
      throw redirect({ to: "/accounts", replace: true });
    }
  },
  component: () => <StaffGate><ListingsReview /></StaffGate>,
});

type Status = "submitted" | "approved" | "published" | "rejected";
const tone: Record<Status, string> = { published: "border-primary text-primary", submitted: "border-warning text-warning", approved: "border-success text-success", rejected: "border-destructive text-destructive" };

function ListingsReview() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all">("submitted");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const q = useQuery({
    queryKey: ["admin", "listing-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listing_drafts").select("*").neq("status", "draft").order("submitted_at", { ascending: false, nullsFirst: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const rows = q.data ?? [];
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const d = rows.find((r) => r.id === sel) ?? null;
  const img = useQuery({
    queryKey: ["admin", "draft-img", d?.image_path],
    enabled: !!d?.image_path,
    queryFn: async () => (await supabase.storage.from("artwork-images").createSignedUrl(d!.image_path!, 600)).data?.signedUrl ?? null,
  });

  const label = (s: string) => ({ submitted: L("Awaiting review", "بانتظار المراجعة"), approved: L("Approved · awaiting publication", "مقبول · بانتظار النشر"), published: L("Published", "منشور"), rejected: L("Rejected", "مرفوض") } as Record<string, string>)[s] ?? s;
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const fmt = (t: string | null) => (t ? new Date(t).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

  const decide = useAction(async (approve: boolean) => {
    if (!d) return;
    setErr("");
    const { error } = await supabase.rpc("admin_review_listing" as never, { _id: d.id, _approve: approve, _note: note } as never);
    if (error) { setErr(error.message); throw error; }
    setNote("");
    await qc.invalidateQueries({ queryKey: ["admin", "listing-drafts"] });
  });

  const [price, setPrice] = useState(""); const [cat, setCat] = useState<string>("Painting");
  const publish = useAction(async () => {
    if (!d) return; setErr("");
    const { error } = await supabase.rpc("admin_publish_listing" as never, { _id: d.id, _price: Number(price), _category: cat } as never);
    if (error) { setErr(error.message); throw error; }
    await qc.invalidateQueries({ queryKey: ["admin", "listing-drafts"] });
  });
  const unpublish = useAction(async () => {
    if (!d) return; setErr("");
    const { error } = await supabase.rpc("admin_unpublish_listing" as never, { _id: d.id, _reason: note } as never);
    if (error) { setErr(error.message); throw error; }
    setNote(""); await qc.invalidateQueries({ queryKey: ["admin", "listing-drafts"] });
  });
  const row = d as (typeof d & { published_at?: string | null; published_listing_id?: string | null; price?: number | null; category?: string | null }) | null;
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Staff", "الفريق")} title={L("Listing review", "مراجعة الإعلانات")}
        sub={L("Inspect submitted listings, approve or reject them, and track each one's publishing status.", "افحص الإعلانات المرسلة، واقبلها أو ارفضها، وتابع حالة نشر كل إعلان.")} />
      <div className="mx-auto max-w-6xl space-y-6 px-6 pb-16">
        <div role="group" aria-label={L("Filter by status", "التصفية حسب الحالة")} className="flex flex-wrap gap-2">
          {(["submitted", "approved", "published", "rejected", "all"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}
              className={`rounded-sm border px-3 py-1.5 text-sm ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
              {s === "all" ? L("All", "الكل") : label(s)} ({s === "all" ? rows.length : count(s)})
            </button>
          ))}
          <Link to="/admin/policy-review" className="ms-auto self-center text-sm underline">{L("AI policy screening", "الفحص الآلي للسياسات")}</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          <ul className="space-y-2" aria-label={L("Listings", "الإعلانات")}>
            {q.isLoading && <li className="text-sm text-muted-foreground">…</li>}
            {q.error && <li role="alert" className="text-sm text-destructive">{L("Couldn't load listings.", "تعذّر تحميل الإعلانات.")}</li>}
            {!q.isLoading && shown.length === 0 && <li className="text-sm text-muted-foreground">{L("No listings here.", "لا توجد إعلانات هنا.")}</li>}
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={sel === r.id} onClick={() => { setSel(r.id); setNote(""); setErr(""); }}
                  className={`w-full rounded-sm border p-3 text-start ${sel === r.id ? "border-primary" : "border-border hover:border-primary"}`}>
                  <span className="block truncate font-medium">{(ar ? r.title_ar : r.title) || L("Untitled", "بدون عنوان")}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className={`rounded-sm border px-1.5 ${tone[r.status as Status] ?? ""}`}>{label(r.status)}</span>
                    <span>{fmt(r.submitted_at ?? r.reviewed_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {!d ? <p className="rounded-sm border border-border p-6 text-muted-foreground">{L("Select a listing to inspect it.", "اختر إعلاناً لفحصه.")}</p> : (
            <article className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                {d.image_path ? (img.data ? <img src={img.data} alt={(ar ? d.alt_text_ar : d.alt_text) || ""} className="max-h-[420px] w-full rounded-sm border border-border object-contain" /> : <div className="aspect-[4/5] animate-pulse rounded-sm bg-muted" />)
                  : <p className="rounded-sm border border-destructive p-4 text-sm text-destructive">{L("No image attached.", "لا توجد صورة.")}</p>}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">{L("Publishing status", "حالة النشر")}</dt><dd><span className={`rounded-sm border px-1.5 ${tone[d.status as Status] ?? ""}`}>{label(d.status)}</span></dd>
                  <dt className="text-muted-foreground">{L("Submitted", "أُرسل")}</dt><dd>{fmt(d.submitted_at)}</dd>
                  <dt className="text-muted-foreground">{L("Reviewed", "رُوجع")}</dt><dd>{fmt(d.reviewed_at)}</dd>
                  <dt className="text-muted-foreground">{L("Published", "نُشر")}</dt><dd>{fmt(row?.published_at ?? null)}</dd>
                  {d.review_note && (<><dt className="text-muted-foreground">{L("Reviewer note", "ملاحظة المراجع")}</dt><dd>{d.review_note}</dd></>)}
                </dl>
              </div>
              <div className="space-y-4">
                <dl className="space-y-3 text-sm">
                  {([["Title", "العنوان", d.title, d.title_ar], ["Description", "الوصف", d.description, d.description_ar], ["Alt text", "النص البديل", d.alt_text, d.alt_text_ar]] as const).map(([en, a, v, va]) => (
                    <div key={en}><dt className="font-medium">{L(en, a)}</dt><dd dir="ltr" lang="en" className="text-start">{v || "—"}</dd><dd dir="rtl" lang="ar">{va || "—"}</dd></div>
                  ))}
                  <div><dt className="font-medium">{L("Medium & tags", "الوسيط والوسوم")}</dt><dd>{[d.medium, ...d.tags].filter(Boolean).join(" · ") || "—"}</dd></div>
                </dl>
                {d.status === "submitted" ? (
                  <div className="space-y-3 rounded-sm border border-border p-4">
                    <label className="block text-sm">{L("Note to seller (required to reject)", "ملاحظة للبائع (مطلوبة عند الرفض)")}
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton state={decide.state} onClick={() => decide.run(true)} loadingLabel={L("Saving…", "جارٍ الحفظ…")} successLabel={L("Saved", "تم الحفظ")}
                        errorLabel={err || L("Couldn't save the decision.", "تعذّر حفظ القرار.")} onRetry={decide.retry} retryLabel={L("Try again", "حاول مجدداً")}
                        className="rounded-sm bg-success px-4 py-2 text-primary-foreground">{L("Approve", "قبول")}</ActionButton>
                      <button type="button" disabled={decide.busy || note.trim().length < 5} onClick={() => decide.run(false)}
                        className="rounded-sm border border-destructive px-4 py-2 text-destructive disabled:opacity-50">{L("Reject", "رفض")}</button>
                    </div>
                    <p className="text-xs text-muted-foreground">{L("The seller is notified either way. Every decision is logged.", "يُبلَّغ البائع في الحالتين، ويُسجَّل كل قرار.")}</p>
                  </div>
                ) : d.status === "rejected" ? (<RevisionGuidance key={d.id} draftId={d.id} initialNotes={d.review_note ?? ""} />) : d.status === "approved" ? (
                  <div className="space-y-3 rounded-2xl border border-border p-4">
                    <p className="font-medium">{L("Publish to the shop", "النشر في المتجر")}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">{L("Price (USD)", "السعر (دولار)")}<input type="number" min={1} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
                      <label className="text-sm">{L("Category", "التصنيف")}<select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2">{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                    </div>
                    <ActionButton state={publish.state} onClick={() => publish.run()} disabled={!(Number(price) > 0)} loadingLabel={L("Publishing…", "جارٍ النشر…")} successLabel={L("Published", "تم النشر")}
                      errorLabel={err || L("Couldn't publish.", "تعذّر النشر.")} onRetry={publish.retry} retryLabel={L("Try again", "حاول مجدداً")}
                      className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{L("Publish listing", "انشر الإعلان")}</ActionButton>
                    <p className="text-xs text-muted-foreground">{L("It appears under “New from sellers” on Explore, the seller is notified, and saved-search alerts go out.", "يظهر ضمن «جديد من البائعين» في صفحة الاستكشاف، ويُبلَّغ البائع، وتُرسل تنبيهات البحث المحفوظ.")}</p>
                  </div>
                ) : d.status === "published" ? (
                  <div className="space-y-3 rounded-2xl border border-border p-4">
                    <p className="text-sm">{L("Live in the shop", "منشور في المتجر")} · ${Number(row?.price ?? 0).toLocaleString()} · {row?.category}</p>
                    {row?.published_listing_id && <Link to="/listing/$id" params={{ id: row.published_listing_id }} className="text-sm underline">{L("View in shop", "اعرضه في المتجر")}</Link>}
                    <label className="block text-sm">{L("Reason for taking it down (sent to seller)", "سبب الإزالة (يُرسل للبائع)")}<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
                    <button type="button" disabled={unpublish.busy || note.trim().length < 5} onClick={() => unpublish.run()} className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive disabled:opacity-50">{L("Unpublish", "إلغاء النشر")}</button>
                    {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">{L("This listing has already been reviewed. If the seller edits it, it returns to draft and can be submitted again.", "تمت مراجعة هذا الإعلان. إذا عدّله البائع يعود مسودة ويمكن إرساله مجدداً.")}</p>}
              </div>
              <EvidenceCheck key={`ev-${d.id}`} draftId={d.id} description={`${d.description ?? ""}${d.description_ar ? `\n\n${d.description_ar}` : ""}`} />
              <ListingVersionHistory key={d.id} draftId={d.id} />
            </article>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
