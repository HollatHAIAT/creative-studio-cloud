import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, CheckCheck, ExternalLink } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { checkWatchedPages } from "@/lib/page-watch.functions";

export const Route = createFileRoute("/_authenticated/admin/watch")({
  head: () => ({ meta: [
    { title: "Page watch — Arwiqa admin" },
    { name: "description", content: "Daily checks of competitor and regulator pages, showing only what changed." },
    { property: "og:title", content: "Page watch — Arwiqa admin" },
    { property: "og:description", content: "What changed on watched competitor and regulator pages." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <StaffGate><Watch /></StaffGate>,
});

type Page = { id: string; url: string; label: string; kind: string; active: boolean; last_checked_at: string | null; last_error: string | null };
type Change = { id: string; page_id: string; checked_at: string; added: string[]; removed: string[]; seen_at: string | null };

function Watch() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const qc = useQueryClient();
  const check = useServerFn(checkWatchedPages);
  const [url, setUrl] = useState(""); const [label, setLabel] = useState(""); const [kind, setKind] = useState("competitor");
  const [busy, setBusy] = useState<string | null>(null); const [showSeen, setShowSeen] = useState(false);
  const pages = useQuery({ queryKey: ["watch-pages"], queryFn: async () => { const { data, error } = await supabase.from("watch_pages").select("id,url,label,kind,active,last_checked_at,last_error").order("created_at"); if (error) throw error; return data as Page[]; } });
  const changes = useQuery({ queryKey: ["watch-changes", showSeen], queryFn: async () => {
    let q = supabase.from("watch_changes").select("id,page_id,checked_at,added,removed,seen_at").order("checked_at", { ascending: false }).limit(100);
    if (!showSeen) q = q.is("seen_at", null);
    const { data, error } = await q; if (error) throw error; return data as Change[];
  } });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["watch-pages"] }); qc.invalidateQueries({ queryKey: ["watch-changes"] }); };
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : L("never", "لم يُفحص");

  const add = async () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(u)) { toast.error(L("Enter a full web address starting with https://", "أدخل عنوانًا كاملًا يبدأ بـ https://")); return; }
    const { data, error } = await supabase.from("watch_pages").insert({ url: u, label: label.trim(), kind }).select("id").single();
    if (error) { toast.error(error.code === "23505" ? L("That page is already watched.", "هذه الصفحة مراقبة مسبقًا.") : error.message); return; }
    setUrl(""); setLabel(""); refresh();
    toast.success(L("Added — taking the first snapshot…", "أُضيفت — جارٍ أخذ النسخة الأولى…"));
    await runCheck(data.id);
  };
  const runCheck = async (id?: string) => {
    setBusy(id ?? "all");
    try { const r = await check({ data: { id } }); toast.success(L(`Checked ${r.checked} · ${r.changed} changed${r.failed ? ` · ${r.failed} failed` : ""}`, `فُحصت ${r.checked} · تغيّرت ${r.changed}${r.failed ? ` · فشلت ${r.failed}` : ""}`)); }
    catch { toast.error(L("Check failed.", "فشل الفحص.")); }
    finally { setBusy(null); refresh(); }
  };
  const remove = async (p: Page) => { if (!confirm(L(`Stop watching ${p.label || p.url}?`, `إيقاف مراقبة ${p.label || p.url}؟`))) return; await supabase.from("watch_pages").delete().eq("id", p.id); refresh(); };
  const markSeen = async (ids: string[]) => { if (!ids.length) return; await supabase.from("watch_changes").update({ seen_at: new Date().toISOString() }).in("id", ids); refresh(); };
  const pageOf = (id: string) => pages.data?.find((p) => p.id === id);
  const kindLabel = (k: string) => k === "regulator" ? L("Regulator", "جهة تنظيمية") : L("Competitor", "منافس");

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Admin", "الإدارة")} title={L("Page watch", "مراقبة الصفحات")} sub={L("Competitor and regulator pages are checked every day. Only what changed since the last check is shown.", "تُفحص صفحات المنافسين والجهات التنظيمية يوميًا، ولا يظهر إلا ما تغيّر منذ آخر فحص.")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-20 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="ch-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="ch-h" className="font-display text-2xl">{showSeen ? L("All changes", "كل التغييرات") : L("New changes", "تغييرات جديدة")}</h2>
            <div className="flex gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} />{L("Include reviewed", "اعرض المراجَعة")}</label>
              {!showSeen && !!changes.data?.length && <button onClick={() => void markSeen(changes.data!.map((c) => c.id))} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><CheckCheck aria-hidden className="h-4 w-4" />{L("Mark all reviewed", "تعليم الكل كمراجَع")}</button>}
            </div>
          </div>
          {changes.isLoading ? <p className="mt-4 text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>
            : !changes.data?.length ? <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-muted-foreground">{L("No changes since the last check.", "لا تغييرات منذ آخر فحص.")}</p>
            : <ul className="mt-4 space-y-4">{changes.data.map((c) => { const p = pageOf(c.page_id); return (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium">{p?.label || p?.url}</p>
                    <p className="text-xs text-muted-foreground">{p && kindLabel(p.kind)} · {fmt(c.checked_at)} · <a href={p?.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">{L("open page", "افتح الصفحة")}<ExternalLink aria-hidden className="h-3 w-3" /></a></p></div>
                  {!c.seen_at && <button onClick={() => void markSeen([c.id])} className="text-sm text-primary underline">{L("Mark reviewed", "تعليم كمراجَع")}</button>}
                </div>
                {c.added.length > 0 && <div className="mt-3"><p className="text-xs font-medium text-success">{L(`Added (${c.added.length})`, `أُضيف (${c.added.length})`)}</p>
                  <ul className="mt-1 space-y-1 text-sm">{c.added.slice(0, 30).map((l, i) => <li key={i} dir="auto" className="rounded bg-success/10 px-2 py-1">+ {l}</li>)}</ul></div>}
                {c.removed.length > 0 && <div className="mt-3"><p className="text-xs font-medium text-destructive">{L(`Removed (${c.removed.length})`, `حُذف (${c.removed.length})`)}</p>
                  <ul className="mt-1 space-y-1 text-sm">{c.removed.slice(0, 30).map((l, i) => <li key={i} dir="auto" className="rounded bg-destructive/10 px-2 py-1 line-through decoration-destructive/40">− {l}</li>)}</ul></div>}
                {(c.added.length > 30 || c.removed.length > 30) && <p className="mt-2 text-xs text-muted-foreground">{L("Showing the first 30 lines of each.", "يظهر أول ٣٠ سطرًا من كلٍّ منهما.")}</p>}
              </li>); })}</ul>}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl">{L("Watched pages", "الصفحات المراقبة")}</h2>
            <div className="mt-3 space-y-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label={L("Page address", "عنوان الصفحة")} dir="ltr" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder={L("Name (optional)", "الاسم (اختياري)")} aria-label={L("Name", "الاسم")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={L("Type", "النوع")} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="competitor">{kindLabel("competitor")}</option><option value="regulator">{kindLabel("regulator")}</option></select>
                <button onClick={() => void add()} disabled={!!busy} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"><Plus aria-hidden className="h-4 w-4" />{L("Add", "أضف")}</button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">{(pages.data ?? []).map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate font-medium">{p.label || p.url}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{p.url}</p>
                    <p className="text-xs text-muted-foreground">{kindLabel(p.kind)} · {L("checked", "فُحصت")} {fmt(p.last_checked_at)}</p>
                    {p.last_error && <p className="text-xs text-destructive">{p.last_error}</p>}</div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => void runCheck(p.id)} disabled={!!busy} aria-label={L("Check now", "افحص الآن")} className="rounded p-1.5 hover:bg-muted"><RefreshCw aria-hidden className={`h-4 w-4 ${busy === p.id ? "animate-spin" : ""}`} /></button>
                    <button onClick={() => void remove(p)} aria-label={L("Stop watching", "أوقف المراقبة")} className="rounded p-1.5 text-destructive hover:bg-muted"><Trash2 aria-hidden className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>))}</ul>
            {!!pages.data?.length && <button onClick={() => void runCheck()} disabled={!!busy} className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"><RefreshCw aria-hidden className={`h-4 w-4 ${busy === "all" ? "animate-spin" : ""}`} />{L("Check all now", "افحص الكل الآن")}</button>}
            <p className="mt-3 text-xs text-muted-foreground">{L("Automatic check every day at 06:00 Riyadh time.", "فحص تلقائي يوميًا الساعة ٦:٠٠ صباحًا بتوقيت الرياض.")}</p>
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}
