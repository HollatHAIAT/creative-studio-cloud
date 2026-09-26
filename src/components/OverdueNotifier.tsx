import { useEffect } from "react";
import { toast } from "sonner";
import { alertHistory } from "@/lib/analytics";
import { daysPast, targetFor } from "@/lib/alert-rules";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";

/** Notifies (per the creator's preferences) when an ongoing alert group passes its recovery target, respecting a cooldown. */
export function OverdueNotifier() {
  const { alerts: cfg, notify, overdueNotified, maintenance } = useStore();
  const listings = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR && l.status !== "archived" && !cfg.paused.includes(l.id));
  const ids = listings.map((l) => l.id).join();
  useEffect(() => {
    if (!notify.inApp && !notify.email) return;
    const now = Date.now();
    if (maintenance.some((w) => Date.parse(w.start) <= now && now <= Date.parse(w.end))) return; // planned downtime
    const cooldown = (notify.cooldownHours ?? 24) * 3600000;
    const due = listings.flatMap((l) => alertHistory(l.id, cfg).filter((g) => daysPast(g, cfg) > 0).map((g) => ({ key: `${l.id}:${g.metric}`, title: l.title, g })))
      .filter((x) => !overdueNotified[x.key] || Date.now() - overdueNotified[x.key]! > cooldown);
    if (!due.length) return;
    actions.markOverdueNotified(due.map((d) => d.key));
    const lines = due.slice(0, 3).map((d) => `${d.title} (${d.g.metric}): ${daysPast(d.g, cfg)}d past ${targetFor(d.g, cfg)}-day target`);
    const extra = due.length > 3 ? ` +${due.length - 3} more` : "";
    const via = notify.email ? (notify.address ? ` · email to ${notify.address} queued` : " · add an email address to get emails") : "";
    if (notify.inApp) toast.warning(`${due.length} alert${due.length > 1 ? "s" : ""} past recovery target`, { description: lines.join(" · ") + extra + via, duration: 12000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, JSON.stringify(cfg), notify.inApp, notify.email, notify.cooldownHours, JSON.stringify(maintenance)]);
  return null;
}
