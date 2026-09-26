import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, FavButton } from "@/components/SiteShell";
import { artworks, creatorOf, fmt, MATERIAL_AR, type Variant, type VariantKind } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale, type Key } from "@/lib/i18n";
import { auctionFor, statusOf, useNow } from "@/lib/auctions";

export const Route = createFileRoute("/artwork/$id")({
  head: ({ params }) => {
    const a = artworks.find((x) => x.id === params.id);
    const title = a ? `${a.title} by ${a.artist} — creativestudio` : "Artwork — creativestudio";
    const desc = a?.description ?? "Original art, prints and licenses on creativestudio.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: Detail,
});

const kindKey: Record<VariantKind, Key> = { original: "art.original", print: "art.print", license: "art.license" };
const licKey = { personal: "form.personal", commercial: "form.commercial", extended: "form.extended" } as const;

function Detail() {
  const { id } = Route.useParams();
  const { t, pick, locale, num } = useLocale();
  const a = useListings().find((x) => x.id === id);
  const now = useNow(60_000);
  const [img, setImg] = useState(0);
  const [kind, setKind] = useState<VariantKind | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const [lic, setLic] = useState<string | null>(null);
  if (!a) return <SiteShell><div className="p-16 text-center"><p>{t("art.unavailable")}</p><Link to="/explore" className="underline">{t("art.back")}</Link></div></SiteShell>;
  const creator = creatorOf(a.creatorId);
  const auc = auctionFor(a.id);
  const aucLive = auc && now > 0 && statusOf(auc, now) !== "closed";
  const kinds = (["original", "print", "license"] as VariantKind[]).filter((k) => a.variants.some((v) => v.kind === k));
  const k = kind ?? kinds[0];
  const ofKind = a.variants.filter((v) => v.kind === k);
  const sizes = [...new Set(ofKind.map((v) => v.size).filter(Boolean))] as string[];
  const s = size && sizes.includes(size) ? size : sizes[0];
  const materials = [...new Set(ofKind.filter((v) => v.size === s).map((v) => v.material).filter(Boolean))] as string[];
  const m = material && materials.includes(material) ? material : materials[0];
  let v: Variant | undefined;
  if (k === "print") v = ofKind.find((x) => x.size === s && x.material === m);
  else if (k === "license") v = ofKind.find((x) => x.id === lic) ?? ofKind[0];
  else v = ofKind[0];
  const left = v?.edition ? v.edition - (v.sold ?? 0) : null;
  const soldOut = left !== null && left <= 0;
  const mat = (x: string) => (locale === "ar" ? MATERIAL_AR[x] ?? x : x);
  const label = v ? [t(kindKey[v.kind]), v.size, v.material && mat(v.material), v.license && t(licKey[v.license])].filter(Boolean).join(" · ") : "";
  const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <div>
          <div className="relative">
            <img src={a.images[img] ?? a.image} alt={pick(a, "title")} className="aspect-[4/5] w-full rounded-sm object-cover" />
            <FavButton id={a.id} className="absolute end-4 top-4" />
          </div>
          {a.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {a.images.map((src, i) => (
                <button key={i} onClick={() => setImg(i)} className={`h-20 w-20 overflow-hidden rounded-sm border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">{t(`cat.${a.category}` as Key)}</p>
          <h1 className="mt-2 font-display text-5xl">{pick(a, "title")}</h1>
          {creator && <Link to="/artists/$id" params={{ id: creator.id }} className="mt-2 inline-block underline">{pick(creator, "name")}</Link>}
          <p className="mt-1 text-muted-foreground">{pick(a, "medium")} · {a.year}</p>
          <p className="mt-6 leading-relaxed">{pick(a, "description")}</p>

          <p className="mt-8 text-sm uppercase tracking-widest">{t("art.format")}</p>
          <div className="mt-3 flex flex-wrap gap-2">{kinds.map((x) => <button key={x} onClick={() => setKind(x)} className={chip(k === x)}>{t(kindKey[x])}</button>)}</div>
          {k === "print" && (
            <>
              <p className="mt-5 text-sm">{t("art.size")}</p>
              <div className="mt-2 flex flex-wrap gap-2">{sizes.map((x) => <button key={x} onClick={() => setSize(x)} className={chip(s === x)} dir="ltr">{x}</button>)}</div>
              <p className="mt-5 text-sm">{t("art.material")}</p>
              <div className="mt-2 flex flex-wrap gap-2">{materials.map((x) => <button key={x} onClick={() => setMaterial(x)} className={chip(m === x)}>{mat(x)}</button>)}</div>
            </>
          )}
          {k === "license" && (
            <div className="mt-5 grid gap-2">
              {ofKind.map((x) => (
                <button key={x.id} onClick={() => setLic(x.id)} className={`flex justify-between rounded-sm border p-3 text-sm ${v?.id === x.id ? "border-primary" : "border-border"}`}>
                  <span>{x.license && t(licKey[x.license])}</span><span>{fmt(x.price)}</span>
                </button>
              ))}
            </div>
          )}

          <p className="mt-8 font-display text-4xl">{v ? fmt(v.price) : "—"}</p>
          {left !== null && <p className="text-sm text-muted-foreground">{v?.edition === 1 ? t("art.original") : `${t("art.edition")} ${num(v!.edition!)}`} · {soldOut ? t("art.soldOut") : `${num(left)} ${t("art.left")}`}</p>}
          <button disabled={!v || soldOut} onClick={() => toast.success(`${pick(a, "title")} (${label}) — ${t("art.added")}`)} className="mt-4 w-full rounded-full bg-primary py-4 text-primary-foreground disabled:opacity-50">{t("art.buy")}</button>
          <p className="mt-3 text-xs text-muted-foreground">{t("art.cert")}</p>

          {auc && aucLive && (
            <div className="mt-8 flex items-center justify-between rounded-sm border border-primary p-5">
              <p className="text-sm">{t("art.liveAuction")}</p>
              <Link to="/auctions/$id" params={{ id: auc.id }} className="rounded-full border border-foreground px-4 py-2 text-sm">{t("art.goAuction")}</Link>
            </div>
          )}
          {creator && (
            <div className="mt-8 flex items-center gap-4 border-t border-border pt-6">
              <img src={creator.image} alt="" className="h-12 w-12 rounded-full object-cover" />
              <div><p>{pick(creator, "name")}</p><p className="text-sm text-muted-foreground">{pick(creator, "discipline")} · {pick(creator, "city")}</p></div>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
