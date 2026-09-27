import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useMemo, useRef, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { artists } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { useL } from "@/components/editorial";

const TRENDING: [string, string][] = [
  ["Saudi artists", "فنانين سعوديين"], ["Abstract", "فن تجريدي"], ["Photography", "تصوير فوتوغرافي"],
  ["Calligraphy", "خط عربي"], ["Limited prints", "نسخ محدودة"], ["Auctions ending soon", "مزادات تنتهي قريبًا"],
];

/** Search as a discovery tool: focusing opens a panel with trends, artists and artworks. */
export function DiscoverySearch({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const L = useL();
  const { pick, locale } = useLocale();
  const all = useListings();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const term = q.trim().toLowerCase();
  const works = useMemo(() => (term ? all.filter((a) => [a.title, a.titleAr, a.artist, a.artistAr, a.category, a.medium].join(" ").toLowerCase().includes(term)) : all).slice(0, 4), [all, term]);
  const people = useMemo(() => (term ? artists.filter((a) => [a.name, a.nameAr, a.discipline, a.city].join(" ").toLowerCase().includes(term)) : artists).slice(0, 3), [term]);
  const go = (s: string) => { setOpen(false); onNavigate?.(); nav({ to: "/explore", search: { q: s || undefined } }); };

  return (
    <div ref={wrap} className="relative" onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }}
        className="flex items-center gap-3 border-b-2 border-foreground/80 bg-transparent py-3 transition focus-within:border-primary">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} autoFocus={autoFocus}
          aria-label={L("Search artworks, artists, exhibitions or auctions", "ابحث عن عمل، فنان، معرض أو مزاد")} aria-expanded={open} aria-controls={panelId}
          placeholder={L("Search an artwork, artist, exhibition or auction…", "ابحث عن عمل، فنان، معرض أو مزاد...")}
          className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground md:text-xl" />
        <button type="submit" className="shrink-0 text-sm text-primary hover:underline">{L("Search", "بحث")}</button>
      </form>
      {open && (
        <div id={panelId} className="rise-in absolute inset-x-0 top-full z-30 mt-2 grid gap-6 border border-border bg-surface p-6 shadow-float md:grid-cols-[1fr_1fr_1.4fr]">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" aria-hidden />{L("Trending", "الأكثر بحثًا")}</p>
            <ul className="space-y-2">{TRENDING.map(([en, ar]) => (
              <li key={en}><button type="button" onClick={() => go(locale === "ar" ? ar : en)} className="text-start hover:text-primary">{locale === "ar" ? ar : en}</button></li>
            ))}</ul>
          </div>
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{L("Artists", "فنانون")}</p>
            <ul className="space-y-3">{people.map((p) => (
              <li key={p.id}><Link to="/artists/$id" params={{ id: p.id }} onClick={() => { setOpen(false); onNavigate?.(); }} className="flex items-center gap-3 hover:text-primary">
                <img src={p.image} alt="" className="h-9 w-9 rounded-full object-cover" /><span><span className="block text-sm">{pick(p, "name")}</span><span className="block text-xs text-muted-foreground">{pick(p, "discipline")} · {pick(p, "city")}</span></span>
              </Link></li>
            ))}{people.length === 0 && <li className="text-sm text-muted-foreground">{L("No artists match", "لا يوجد فنانون مطابقون")}</li>}</ul>
          </div>
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{L("Artworks", "أعمال")}</p>
            <div className="grid grid-cols-4 gap-2">{works.map((w) => (
              <Link key={w.id} to="/artwork/$id" params={{ id: w.id }} onClick={() => { setOpen(false); onNavigate?.(); }} className="group block">
                <img src={w.image} alt={pick(w, "title")} className="aspect-square w-full object-cover transition group-hover:opacity-80" />
                <span className="mt-1 block truncate text-xs">{pick(w, "title")}</span>
              </Link>
            ))}</div>
            {works.length === 0 && <p className="text-sm text-muted-foreground">{L("No artworks match — try another word.", "لا توجد أعمال مطابقة — جرّب كلمة أخرى.")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
