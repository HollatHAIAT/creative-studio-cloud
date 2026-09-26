import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { BankTile } from "@/components/BankTile";
import { saudiBanks } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { FORMATS, assetBlob, fileName, metadataCsv, save, zip, type AssetFormat } from "@/lib/bank-assets";

export const Route = createFileRoute("/collections/saudi-banks")({
  head: () => ({
    meta: [
      { title: "Saudi Banks digital asset collection — creativestudio" },
      { name: "description", content: "Free logo asset collection for ten Saudi banks: select, choose PNG, JPG, SVG or PDF, and download individually or as a ZIP with CSV metadata." },
      { property: "og:title", content: "Saudi Banks collection — creativestudio" },
      { property: "og:description", content: "Free digital assets for Saudi banks with bulk ZIP download and license details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Banks,
});

function Banks() {
  const { t, num } = useLocale();
  const [sel, setSel] = useState<string[]>([]);
  const [fmtSel, setFmt] = useState<AssetFormat | "best">("best");
  const [busy, setBusy] = useState(false);
  const f: AssetFormat = fmtSel === "best" ? "svg" : fmtSel;
  const chosen = saudiBanks.filter((b) => sel.includes(b.id));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    const id = toast.loading(t("banks.preparing"));
    try { await fn(); toast.success(t("banks.download"), { id }); } catch { toast.error("Download failed", { id }); } finally { setBusy(false); }
  }
  const downloadSelected = () => run(async () => {
    if (chosen.length === 1) save(await assetBlob(chosen[0], f), fileName(chosen[0], f));
    else save(await zip(chosen, f), `saudi-banks-${f}.zip`);
  });

  return (
    <SiteShell>
      <PageTitle eyebrow={t("banks.eyebrow")} title={t("banks.title")} sub={t("banks.sub")} />
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-6 rounded-sm border border-primary/40 bg-muted p-4 text-sm">{t("banks.notice")}</p>

        <div className="sticky top-[72px] z-30 mb-6 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-background/95 p-3 backdrop-blur">
          <button onClick={() => setSel(saudiBanks.map((b) => b.id))} className="rounded-full border border-border px-4 py-1.5 text-sm">{t("banks.selectAll")}</button>
          <button onClick={() => setSel([])} className="rounded-full border border-border px-4 py-1.5 text-sm">{t("banks.clear")}</button>
          <span className="text-sm text-muted-foreground">{num(sel.length)} {t("banks.selected")}</span>
          <label className="ms-auto flex items-center gap-2 text-sm">{t("banks.format")}
            <select value={fmtSel} onChange={(e) => setFmt(e.target.value as AssetFormat | "best")} className="rounded-full border border-border bg-background px-3 py-1.5">
              <option value="best">{t("banks.best")} (SVG)</option>
              {FORMATS.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
            </select>
          </label>
          <button disabled={!chosen.length || busy} onClick={downloadSelected} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {chosen.length > 1 ? t("banks.zip") : t("banks.download")}
          </button>
          <button disabled={!chosen.length} onClick={() => save(new Blob([metadataCsv(chosen, f)], { type: "text/csv" }), "saudi-banks-metadata.csv")} className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50">{t("banks.csv")}</button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {saudiBanks.map((b) => <BankTile key={b.id} b={b} selected={sel.includes(b.id)} onToggle={() => setSel((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]))} />)}
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-sm border border-border bg-card p-6"><p className="text-xs uppercase tracking-widest text-primary">{t("banks.license")}</p><p className="mt-2 font-display text-3xl">{t("banks.free")}</p></div>
          <div className="rounded-sm border border-border bg-card p-6"><p className="text-xs uppercase tracking-widest text-primary">{t("banks.formats")}</p><p className="mt-2 font-display text-2xl">PNG · JPG · SVG · PDF</p><p className="text-sm text-muted-foreground">CSV · ZIP</p></div>
          <div className="rounded-sm border border-border bg-card p-6"><p className="text-xs uppercase tracking-widest text-primary">{t("banks.details")}</p><p className="mt-2 text-sm">{t("banks.licenseText")}</p></div>
        </section>
      </div>
    </SiteShell>
  );
}
