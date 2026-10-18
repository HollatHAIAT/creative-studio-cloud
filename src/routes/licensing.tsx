import { usePlatformSettings, num } from "@/lib/platform-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";
import { fill } from "@/lib/i18n-pages";

export const Route = createFileRoute("/licensing")({
  head: () => ({
    meta: [
      { title: "Licensing — Arwiqa أروقة" },
      { name: "description", content: "Compare personal, commercial and extended digital licenses for artworks on Arwiqa." },
      { property: "og:title", content: "Artwork licensing on Arwiqa" },
      { property: "og:description", content: "Personal, commercial and extended licenses explained." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Licensing,
});

function Licensing() {
  const { locale, t } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ps = usePlatformSettings();
  const tiers = [t("lic.personal"), t("lic.commercial"), t("lic.extended")];
  const rows: [string, boolean, boolean, boolean][] = [
    [t("lic.row1"), true, true, true],
    [t("lic.row2"), false, true, true],
    [fill(t("lic.row3"), { n: num(ps.commercial_print_limit, ar) }), false, true, true],
    [t("lic.row4"), false, false, true],
    [t("lic.row5"), false, false, true],
  ];
  const steps = [
    t("lic.step1"),
    t("lic.step2"),
    t("lic.step3"),
    t("lic.step4"),
  ];
  return (
    <SiteShell>
      <PageTitle eyebrow={t("about.eyebrow")} title={t("lic.title")} sub={t("lic.sub")} />
      <div className="mx-auto max-w-4xl px-6">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr><th className="p-3 text-start">{t("lic.use")}</th>{tiers.map((t) => <th key={t} className="p-3">{t}</th>)}</tr></thead>
            <tbody>{rows.map(([u, ...v]) => (
              <tr key={u} className="border-t border-border"><td className="p-3">{u}</td>{v.map((ok, i) => <td key={i} className="p-3 text-center">{ok ? <Check aria-label={L("Allowed", "مسموح")} className="mx-auto h-4 w-4 text-primary" /> : <X aria-label={L("Not allowed", "غير مسموح")} className="mx-auto h-4 w-4 text-muted-foreground" />}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fill(t("lic.note"), { c: num(ps.commercial_multiplier, ar), e: num(ps.extended_multiplier, ar) })}</p>
        <h2 className="mt-10 font-display text-2xl">{t("lic.how")}</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">{steps.map((s, i) => <li key={i} className="rounded-xl bg-muted p-4 text-sm"><span className="font-display text-primary">{i + 1}</span> {s}</li>)}</ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/explore" search={{ format: "license" }} className="rounded-full bg-primary px-5 py-2 text-primary-foreground">{t("lic.cta.browse")}</Link>
          <Link to="/support" className="rounded-full border border-border px-5 py-2">{t("lic.cta.custom")}</Link>
        </div>
      </div>
    </SiteShell>
  );
}
