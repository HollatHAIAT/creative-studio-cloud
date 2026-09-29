import { TrustPanel } from "@/components/TrustPanel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArtStage } from "@/components/ArtViewer";
import { useEffect, useState } from "react";
import { trackView, useRecentlyViewed } from "@/lib/recently-viewed";
import { toast } from "sonner";
import { SiteShell, FavButton, ArtCard } from "@/components/SiteShell";
import { artworks, creatorOf, fmt, MATERIAL_AR, type Variant, type VariantKind } from "@/lib/data";
import { actions, useListings } from "@/lib/store";
import { useListingAgent } from "@/lib/marketplace";
import { ArtworkActions } from "@/components/ArtworkActions";
import { Reviews } from "@/components/Reviews";
import { useNavigate } from "@tanstack/react-router";
import { useLocale, type Key } from "@/lib/i18n";
import { auctionFor, statusOf, useNow } from "@/lib/auctions";

export const Route = createFileRoute("/artwork/$id")({
  head: ({ params }) => {
    const a = artworks.find((x) => x.id === params.id);
    const title = a ? `${a.title} by ${a.artist} — Arwiqa أروقة` : "Artwork — Arwiqa أروقة";
    const desc = a?.description ?? "Original art, prints and licenses on Arwiqa.";
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
  const all = useListings();
  const a = all.find((x) => x.id === id);
  const now = useNow(60_000);
  const navigate = useNavigate();
  const [img, setImg] = useState(0);
  const [kind, setKind] = useState<VariantKind | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const [lic, setLic] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [showLic, setShowLic] = useState(false);
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { data: agent } = useListingAgent(id);
  useEffect(() => { trackView(id); }, [id]);
  const recentIds = useRecentlyViewed(id);
  if (!a) return <SiteShell><div className="p-16 text-center"><p>{t("art.unavailable")}</p><Link to="/explore" className="underline">{t("art.back")}</Link></div></SiteShell>;
  const moreByArtist = all.filter((x) => x.creatorId === a.creatorId && x.id !== a.id).slice(0, 4);
  const similar = all.filter((x) => x.category === a.category && x.creatorId !== a.creatorId).slice(0, 4);
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
  const addToCart = () => { if (!v) return; actions.addToCart({ key: `${a.id}:${v.id}`, kind: "artwork", listingId: a.id, variantId: v.id, qty: v.kind === "print" ? qty : 1 }); };
  const agentBlocked = !!agent && (!agent.valid || !!(v && !agent.scope.includes(v.kind)));
  const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`;

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <div>
          <ArtStage images={a.images.length ? a.images : [a.image]} index={img} onIndex={setImg} alt={pick(a, "title")}>
            <FavButton id={a.id} className="absolute end-4 top-4" />
          </ArtStage>
          {a.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {a.images.map((src, i) => (
                <button key={i} type="button" onClick={() => setImg(i)} aria-label={`${i + 1}`} aria-current={i === img} className={`hover-scale h-20 w-20 overflow-hidden rounded-sm border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
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
          {k !== "license" && k !== "original" && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm">{L("Quantity", "الكمية")}</span>
              <div className="flex items-center rounded-full border border-border">
                <button className="px-3 py-1" onClick={() => setQty(Math.max(1, qty - 1))} aria-label={L("Decrease quantity", "إنقاص الكمية")}>−</button>
                <span className="w-8 text-center">{num(qty)}</span>
                <button className="px-3 py-1" onClick={() => setQty(Math.min(left ?? 10, qty + 1))} aria-label={L("Increase quantity", "زيادة الكمية")}>+</button>
              </div>
            </div>
          )}
          <ArtworkActions listingId={a.id} title={pick(a, "title")} price={v?.price ?? null} disabled={!v || soldOut || agentBlocked}
            blockedReason={agentBlocked ? L("This work is sold by an agent whose owner authorization isn't currently valid, so it can't be bought right now.", "يبيع هذا العمل وكيلٌ تفويضه من المالك غير سارٍ حاليًا، لذا لا يمكن شراؤه الآن.") : undefined}
            onAdd={() => { if (!v) return false; addToCart(); return true; }} />
          <p className="mt-3 text-xs text-muted-foreground">{t("art.cert")}</p>
          <TrustPanel listingId={a.id} />

          {auc && aucLive && (
            <div className="mt-8 flex items-center justify-between rounded-sm border border-primary p-5">
              <p className="text-sm">{t("art.liveAuction")}</p>
              <Link to="/auctions/$id" params={{ id: auc.id }} className="rounded-full border border-foreground px-4 py-2 text-sm">{t("art.goAuction")}</Link>
            </div>
          )}

          <div className="mt-8 rounded-sm border border-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{L("Sold by", "يبيعه")}</p>
            {creator && (
              <div className="mt-3 flex items-center gap-4">
                <img src={creator.image} alt="" className="h-12 w-12 rounded-full object-cover" />
                <div className="flex-1">
                  <p>{pick(creator, "name")} <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L("Owner", "المالك")}</span></p>
                  <p className="text-sm text-muted-foreground">{pick(creator, "discipline")} · {pick(creator, "city")}</p>
                </div>
                <Link to="/artists/$id" params={{ id: creator.id }} className="text-sm underline">{L("View profile", "الملف الشخصي")}</Link>
              </div>
            )}
            {agent && (
              <div className="mt-4 border-t border-border pt-4">
                <p>{locale === "ar" ? agent.agent_name_ar || agent.agent_name : agent.agent_name} <span className={`ms-2 rounded-full px-2 py-0.5 text-xs ${agent.valid ? "bg-accent" : "bg-destructive/10 text-destructive"}`}>{agent.valid ? L("Authorized agent", "وكيل معتمد") : L("Authorization not valid", "التفويض غير سارٍ")}</span></p>
                <p className="text-sm text-muted-foreground">{locale === "ar" ? agent.agency_ar || agent.agency : agent.agency}</p>
                <button aria-expanded={showLic} onClick={() => setShowLic(!showLic)} className="mt-2 text-sm underline">{L("View owner authorization", "عرض تفويض المالك")}</button>
                {showLic && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 rounded-sm bg-muted p-3 text-sm">
                    <dt className="text-muted-foreground">{L("Authorization no.", "رقم التفويض")}</dt><dd dir="ltr" className="text-end">{agent.license_no}</dd>
                    <dt className="text-muted-foreground">{L("Valid until", "سارٍ حتى")}</dt><dd className="text-end">{new Date(agent.valid_until).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</dd>
                    <dt className="text-muted-foreground">{L("May sell", "مخوّل ببيع")}</dt><dd className="text-end">{agent.scope.map((x) => t(kindKey[x as VariantKind])).join(" · ")}</dd>
                    <dt className="text-muted-foreground">{L("Approved by", "بموافقة")}</dt><dd className="text-end">{agent.owner_approved_at ? `${creator ? pick(creator, "name") : "—"} · ${new Date(agent.owner_approved_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}` : L("Not approved", "غير معتمد")}</dd>
                  </dl>
                )}
              </div>
            )}
          </div>

          <ul className="mt-6 grid gap-2 text-sm text-muted-foreground">
            <li>✓ {L("Secure payment: Mada, cards, Apple Pay, STC Pay", "دفع آمن: مدى، البطاقات، Apple Pay، STC Pay")}</li>
            <li>✓ {L("14-day returns on physical works", "إرجاع خلال ١٤ يومًا للأعمال المادية")}</li>
            <li>✓ {L("Verified seller and authenticity certificate", "بائع موثّق وشهادة أصالة")}</li>
          </ul>
        </div>
      </div>
      <Reviews listingId={a.id} />
      {[{ title: L("More from this artist", "المزيد من الفنان"), list: moreByArtist }, { title: L("You may also like", "قد يعجبك أيضًا"), list: similar }, { title: L("Recently viewed", "شاهدتها مؤخرًا"), list: recentIds.map((r) => all.find((x) => x.id === r)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 4) }].filter((g) => g.list.length).map((g) => (
        <section key={g.title} className="mx-auto max-w-7xl px-6 pt-16">
          <h2 className="font-display text-3xl">{g.title}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-4">{g.list.map((x) => <ArtCard key={x.id} a={x} />)}</div>
        </section>
      ))}
    </SiteShell>
  );
}
