import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { exhibitions, fmt, seedListings, toArtwork } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { useLocale, type Key } from "@/lib/i18n";
import { dateRange, fmtDate, openDates, taken } from "@/lib/exhibitions";

export const Route = createFileRoute("/exhibitions/$id")({
  loader: ({ params }) => {
    const e = exhibitions.find((x) => x.id === params.id);
    if (!e) throw notFound();
    return e;
  },
  head: ({ loaderData: e }) => e ? { meta: [
    { title: `${e.title} — exhibition on creativestudio` },
    { name: "description", content: `${e.description} ${e.venue}.` },
    { property: "og:title", content: `${e.title} — creativestudio` },
    { property: "og:description", content: e.description },
    { property: "og:type", content: "event" }, { name: "twitter:card", content: "summary_large_image" },
  ] } : { meta: [{ title: "Exhibition not found" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <SiteShell><p className="p-16 text-center">Exhibition not found.</p></SiteShell>,
  component: ExhibitionPage,
});

const ticketKey: Record<"adult" | "student" | "vip", Key> = { adult: "ex.adult", student: "ex.student", vip: "ex.vip" };

function ExhibitionPage() {
  const e = Route.useLoaderData();
  const { t, pick, locale, num } = useLocale();
  const { bookings } = useStore();
  const dates = openDates(e);
  const [date, setDate] = useState(dates[0] ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({ [e.tickets[0]!.id]: 1 });
  const [room, setRoom] = useState(e.rooms[0]!.id);
  const [virtual, setVirtual] = useState(false);
  const mine = bookings.filter((b) => b.exhibitionId === e.id);
  const bookedHere = (d: string, s: string) => mine.filter((b) => b.date === d && b.slot === s).reduce((n, b) => n + Object.values(b.tickets).reduce((x, y) => x + y, 0), 0);
  const left = (s: string) => e.capacity - taken(e, date, s) - bookedHere(date, s);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const total = e.tickets.reduce((s, tk) => s + tk.price * (qty[tk.id] ?? 0), 0);
  const activeRoom = e.rooms.find((r) => r.id === room)!;
  const works = activeRoom.works.map((id) => toArtwork(seedListings.find((l) => l.id === id)!));
  const allWorks = [...new Set(e.rooms.flatMap((r) => r.works))].map((id) => toArtwork(seedListings.find((l) => l.id === id)!));

  function confirm() {
    if (!slot) return;
    if (count < 1) return;
    if (count > left(slot)) { toast.error(t("ex.soldOut")); return; }
    const ref = `CS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    actions.book({ id: ref, exhibitionId: e.id, date, slot, tickets: qty, total, at: Date.now() });
    toast.success(`${t("ex.booked")} · ${ref}`);
    setSlot(null);
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-6 pt-12">
        <img src={e.image} alt={pick(e, "title")} className="aspect-[21/8] w-full rounded-sm object-cover" />
        <p className="mt-6 text-xs uppercase tracking-widest text-primary">{t(e.type === "Virtual" ? "ex.virtual" : "ex.physical")}</p>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">{pick(e, "title")}</h1>
        <p className="mt-2 text-muted-foreground">{pick(e, "venue")} · {dateRange(e, locale)}</p>
        <p className="mt-4 max-w-2xl">{pick(e, "description")}</p>
      </section>

      <section className="mx-auto mt-12 grid max-w-7xl gap-10 px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="font-display text-3xl">{t("ex.map")}</h2>
          <svg viewBox="0 0 400 240" className="mt-4 w-full rounded-sm border border-border bg-card" role="img" aria-label={t("ex.map")}>
            {e.rooms.map((r) => (
              <g key={r.id} onClick={() => setRoom(r.id)} className="cursor-pointer">
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="4" className={r.id === room ? "fill-primary/20 stroke-primary" : "fill-muted stroke-border"} strokeWidth="2" />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" className="fill-foreground text-[11px]">{pick(r, "name")}</text>
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">{num(r.works.length)}</text>
              </g>
            ))}
          </svg>
          <h3 className="mt-6 font-display text-2xl">{pick(activeRoom, "name")}</h3>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {works.map((w) => (
              <Link key={w.id} to="/artwork/$id" params={{ id: w.id }} className="block">
                <img src={w.image} alt={pick(w, "title")} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
                <p className="mt-1 text-sm">{pick(w, "title")}</p><p className="text-xs text-muted-foreground">{pick(w, "artist")}</p>
              </Link>
            ))}
            {works.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </div>

        <aside className="lg:col-span-2">
          {e.type === "Virtual" ? (
            <div className="rounded-sm border border-border bg-card p-6">
              <p className="font-display text-2xl">{t("ex.virtual")}</p>
              <button onClick={() => setVirtual(true)} className="mt-4 w-full rounded-full bg-primary py-3 text-primary-foreground">{t("ex.enterVirtual")}</button>
            </div>
          ) : (
            <div className="rounded-sm border border-border bg-card p-6">
              <h2 className="font-display text-2xl">{t("ex.book")}</h2>
              <p className="mt-4 text-sm">{t("ex.date")}</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => <button key={d} onClick={() => { setDate(d); setSlot(null); }} className={`shrink-0 rounded-sm border px-3 py-2 text-sm ${d === date ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{fmtDate(d, locale)}</button>)}
              </div>
              <p className="mt-4 text-sm">{t("ex.session")} — {t("ex.schedule")}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {e.slots.map((s) => { const l = left(s); return (
                  <button key={s} disabled={l <= 0} onClick={() => setSlot(s)} className={`rounded-sm border px-2 py-2 text-sm disabled:opacity-40 ${slot === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    <span dir="ltr">{s}</span><br /><span className="text-xs">{l <= 0 ? t("ex.full") : `${num(l)} ${t("ex.left")}`}</span>
                  </button>); })}
              </div>
              <p className="mt-4 text-sm">{t("ex.type")}</p>
              <div className="mt-2 space-y-2">
                {e.tickets.map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between text-sm">
                    <span>{t(ticketKey[tk.id])} · {fmt(tk.price)}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty({ ...qty, [tk.id]: Math.max(0, (qty[tk.id] ?? 0) - 1) })} className="h-8 w-8 rounded-full border border-border">−</button>
                      <span className="w-6 text-center">{num(qty[tk.id] ?? 0)}</span>
                      <button onClick={() => setQty({ ...qty, [tk.id]: Math.min(10, (qty[tk.id] ?? 0) + 1) })} className="h-8 w-8 rounded-full border border-border">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-border pt-4"><span>{t("ex.total")}</span><span className="font-display text-2xl">{fmt(total)}</span></div>
              <button disabled={!slot || count < 1} onClick={confirm} className="mt-4 w-full rounded-full bg-primary py-3 text-primary-foreground disabled:opacity-50">{t("ex.confirm")}</button>
            </div>
          )}

          {mine.length > 0 && (
            <div className="mt-6 rounded-sm border border-border p-6">
              <h3 className="font-display text-xl">{t("ex.bookings")}</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {mine.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span>{fmtDate(b.date, locale)} · <span dir="ltr">{b.slot}</span> · {num(Object.values(b.tickets).reduce((x, y) => x + y, 0))} · {fmt(b.total)}<br /><span className="text-xs text-muted-foreground">{t("ex.ref")}: {b.id}</span></span>
                    <button onClick={() => actions.cancelBooking(b.id)} className="text-xs text-destructive underline">{t("ex.cancel")}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-6">
        <h2 className="mb-6 font-display text-3xl">{t("ex.works")}</h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {allWorks.map((w) => <Link key={w.id} to="/artwork/$id" params={{ id: w.id }}><img src={w.image} alt={pick(w, "title")} loading="lazy" className="aspect-[4/5] w-full rounded-sm object-cover" /><p className="mt-2 font-display">{pick(w, "title")}</p></Link>)}
        </div>
      </section>

      {virtual && (
        <div className="fixed inset-0 z-50 flex flex-col bg-foreground/95 text-background" role="dialog" aria-label={t("ex.enterVirtual")}>
          <div className="flex justify-between p-4"><p className="font-display text-2xl">{pick(e, "title")}</p><button onClick={() => setVirtual(false)} className="rounded-full border border-background px-4 py-1">✕</button></div>
          <div className="flex flex-1 snap-x snap-mandatory items-center gap-16 overflow-x-auto px-[20vw]">
            {allWorks.map((w) => (
              <figure key={w.id} className="shrink-0 snap-center">
                <img src={w.image} alt={pick(w, "title")} className="h-[60vh] rounded-sm object-cover shadow-2xl" />
                <figcaption className="mt-4 text-center">{pick(w, "title")} — {pick(w, "artist")}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </SiteShell>
  );
}
