import { banners, useCmsVersion } from "@/lib/cms";
import { useLocale } from "@/lib/i18n";

/** Admin-managed promotional banners (Content → Banners). Renders nothing when none are published. */
export function HomeBanners() {
  useCmsVersion();
  const { locale } = useLocale();
  const ar = locale === "ar";
  if (!banners.length) return null;
  return (
    <section aria-label={ar ? "إعلانات" : "Announcements"} className="mx-auto grid max-w-7xl gap-4 px-6 pb-8 md:grid-cols-2">
      {banners.map((b) => {
        const title = ar ? b.titleAr || b.title : b.title || b.titleAr;
        const body = ar ? b.bodyAr || b.body : b.body || b.bodyAr;
        const cta = ar ? b.ctaAr || b.cta : b.cta || b.ctaAr;
        const safe = b.link && (b.link.startsWith("/") || b.link.startsWith("https://")) ? b.link : "";
        return (
          <div key={b.key} className="relative flex min-h-40 overflow-hidden rounded-md border border-gold/40 bg-card">
            {b.image && <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
            <div className="relative p-6">
              <p className="font-display text-2xl">{title}</p>
              {body && <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>}
              {safe && cta && <a href={safe} className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{cta}</a>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
