import { useSyncExternalStore } from "react";
import { defaultRetry, type Channel, type RetryPolicy, type RouteRule, type Slo } from "./delivery";
import { defaultAlertConfig, type AlertConfig } from "./analytics";
import { seedListings, toArtwork, type Listing, type ListingStatus } from "./data";

// Demo persistence in the browser; to be replaced by Lovable Cloud with accounts.
export type SavedView = { id: string; name: string; days: number; category: string; status: string };
export type Report = { id: string; name: string; frequency: "weekly" | "monthly"; weekday: number; monthday: number; time: string; timezone: string; email: string; paused: boolean; includeSources: boolean;
  metrics?: ReportMetric[]; sources?: string[]; history?: Delivery[] };
export type ReportMetric = "views" | "favorites" | "purchases" | "conversion" | "top";
export type Delivery = { id: string; at: string; status: "sent" | "failed" | "upcoming" | "retrying"; error?: string };
type State = { mine: Listing[]; removed: string[]; favorites: string[]; views: SavedView[]; reports: Report[]; alerts: AlertConfig; review: Record<string, "acknowledged" | "resolved">; notify: NotifyPrefs; alertSort: { by: "latest" | "repeats" | "drop" | "duration" | "ongoing"; dir: "desc" | "asc" }; alertPresets: AlertPreset[]; overdueNotified: Record<string, number>; owners: Record<string, { name: string; at: number }>; responder: string; maintenance: MaintenanceWindow[]; escalation: Escalation; routes: RouteRule[]; retry: RetryPolicy; manualDeliveries: Record<string, Channel>; slos: Slo[]; breachNotify: { destinations: Channel[]; renotifyHours: number }; breachNotified: Record<string, number>; audit: AuditEvent[]; locale: "en" | "ar"; bids: Record<string, Bid[]>; bookings: Booking[] };
export type Bid = { id: string; bidder: string; amount: number; at: number; mine?: boolean };
export type Booking = { id: string; exhibitionId: string; date: string; slot: string; tickets: Record<string, number>; total: number; at: number };
export type AuditEvent = { key: string; at: number; type: "status" | "acknowledged" | "resolved" | "reopened" | "claimed" | "released" | "notification" | "escalation"; actor: string; detail: string };
export type Escalation = { enabled: boolean; responders: string[]; intervalHours: number };
export type MaintenanceWindow = { id: string; start: string; end: string; note: string };
export type AlertPreset = { id: string; name: string; listing: string; metric: string; status: string; from: string; to: string; recovery?: string };
export type NotifyPrefs = { inApp: boolean; email: boolean; address: string; digest: "instant" | "daily"; cooldownHours?: number };
const KEY = "creativestudio:v1";
const empty: State = { mine: [], removed: [], favorites: [], views: [], reports: [], alerts: defaultAlertConfig, review: {}, notify: { inApp: true, email: false, address: "", digest: "instant" }, alertSort: { by: "latest", dir: "desc" }, alertPresets: [], overdueNotified: {}, owners: {}, responder: "", maintenance: [], escalation: { enabled: false, responders: [], intervalHours: 24 },
  routes: [{ id: "r-default", service: "all", severity: "all", responder: "You", primary: "In-app", fallbacks: ["Email"] }, { id: "r-critical", service: "all", severity: "critical", responder: "You", primary: "SMS", fallbacks: ["Slack", "Email"] }],
  retry: defaultRetry, manualDeliveries: {},
  slos: [{ id: "slo-all", channel: "all", service: "all", severity: "all", minSuccess: 85, maxLatency: 8 }, { id: "slo-webhook", channel: "Webhook", service: "all", severity: "all", minSuccess: 90, maxLatency: 3 }],
  breachNotify: { destinations: ["In-app"], renotifyHours: 0 }, breachNotified: {}, audit: [], locale: "en", bids: {}, bookings: [] };
let state: State = empty;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { state = { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { /* ignore */ }
}
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { alert("Storage is full — try smaller images."); }
  subs.forEach((f) => f());
}
function subscribe(f: () => void) { load(); subs.add(f); queueMicrotask(f); return () => subs.delete(f); }

export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => empty);
}
/** Every listing the store knows about, any status (creator views). */
export function useAllListings() {
  const s = useStore();
  const seed = seedListings.filter((l) => !s.removed.includes(l.id) && !s.mine.some((m) => m.id === l.id));
  return [...s.mine, ...seed].map(toArtwork);
}
/** Public marketplace: published only. */
export function useListings() {
  return useAllListings().filter((l) => l.status === "published");
}
export const DEMO_CREATOR = "layla-haddad";

const findListing = (id: string) => state.mine.find((m) => m.id === id) ?? seedListings.find((l) => l.id === id);

function log(e: Omit<AuditEvent, "at" | "actor"> & { actor?: string }) {
  return [...state.audit, { at: Date.now(), actor: e.actor ?? (state.responder || "You"), ...e }].slice(-2000);
}

export const actions = {
  setLocale(l: "en" | "ar") { set({ ...state, locale: l }); },
  addBid(auctionId: string, b: Bid) { set({ ...state, bids: { ...state.bids, [auctionId]: [...(state.bids[auctionId] ?? []), b] } }); },
  book(b: Booking) { set({ ...state, bookings: [...state.bookings, b] }); },
  cancelBooking(id: string) { set({ ...state, bookings: state.bookings.filter((x) => x.id !== id) }); },
  logAudit(e: Omit<AuditEvent, "at" | "actor"> & { actor?: string }) { set({ ...state, audit: log(e) }); },
  setRoutes(r: RouteRule[]) { set({ ...state, routes: r }); },
  setRetry(r: RetryPolicy) { set({ ...state, retry: r }); },
  manualRetry(id: string, ch: Channel) { set({ ...state, manualDeliveries: { ...state.manualDeliveries, [id]: ch }, audit: log({ key: id.split(":").slice(0, 2).join(":"), type: "notification", detail: `Manual retry delivered via ${ch}` }) }); },
  setSlos(s: Slo[]) { set({ ...state, slos: s }); },
  setBreachNotify(b: State["breachNotify"]) { set({ ...state, breachNotify: b }); },
  markBreachNotified(ids: string[]) { const n = { ...state.breachNotified }; ids.forEach((i) => { n[i] = Date.now(); }); set({ ...state, breachNotified: n }); },
  toggleFavorite(id: string) {
    const f = state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
    set({ ...state, favorites: f });
  },
  save(l: Listing) { set({ ...state, mine: [l, ...state.mine.filter((m) => m.id !== l.id)] }); },
  remove(id: string) { actions.removeMany([id]); },
  /** Returns an undo function. */
  removeMany(ids: string[]) {
    const prev = state;
    set({ ...state, mine: state.mine.filter((m) => !ids.includes(m.id)), removed: [...state.removed, ...ids], favorites: state.favorites.filter((x) => !ids.includes(x)) });
    return () => set({ ...state, mine: prev.mine, removed: prev.removed, favorites: prev.favorites });
  },
  setStatus(ids: string[], status: ListingStatus) {
    const prev = state.mine;
    const updated = ids.map(findListing).filter(Boolean).map((l) => ({ ...l!, status }));
    set({ ...state, mine: [...updated, ...state.mine.filter((m) => !ids.includes(m.id))] });
    return () => set({ ...state, mine: prev });
  },
  saveView(v: SavedView) { set({ ...state, views: [...state.views.filter((x) => x.id !== v.id), v] }); },
  deleteView(id: string) { set({ ...state, views: state.views.filter((x) => x.id !== id) }); },
  saveReport(r: Report) { set({ ...state, reports: [...state.reports.filter((x) => x.id !== r.id), r] }); },
  setReview(key: string, v: "acknowledged" | "resolved" | null) { const r = { ...state.review }; if (v) r[key] = v; else delete r[key]; set({ ...state, review: r, audit: log({ key, type: v ?? "reopened", detail: v ? `Marked ${v}` : "Reopened" }) }); },
  setReviewMany(keys: string[], v: "acknowledged" | "resolved") {
    const prev = state.review;
    const r = { ...prev }; keys.forEach((k) => { r[k] = v; });
    let audit = state.audit; keys.forEach((key) => { state = { ...state, audit }; audit = log({ key, type: v, detail: `Marked ${v} (bulk)` }); });
    set({ ...state, review: r, audit });
    return () => set({ ...state, review: prev });
  },
  saveAlertPreset(p: AlertPreset) { set({ ...state, alertPresets: [...state.alertPresets, p] }); },
  deleteAlertPreset(id: string) { set({ ...state, alertPresets: state.alertPresets.filter((x) => x.id !== id) }); },
  markOverdueNotified(keys: string[]) { const n = { ...state.overdueNotified }; let audit = state.audit; keys.forEach((k) => { n[k] = Date.now(); state = { ...state, audit }; audit = log({ key: k, type: "notification", actor: "System", detail: "Past recovery target — notification sent" }); }); set({ ...state, overdueNotified: n, audit }); },
  claim(key: string, name: string) { const prev = state.owners[key]?.name; state = { ...state, responder: name }; set({ ...state, owners: { ...state.owners, [key]: { name, at: Date.now() } }, audit: log({ key, type: "claimed", actor: name, detail: prev ? `Ownership moved from ${prev} to ${name}` : `Claimed by ${name}` }) }); },
  release(key: string) { const o = { ...state.owners }; const prev = o[key]?.name; delete o[key]; set({ ...state, owners: o, audit: log({ key, type: "released", detail: `Released by ${prev ?? "owner"}` }) }); },
  saveMaintenance(w: MaintenanceWindow) { set({ ...state, maintenance: [...state.maintenance.filter((x) => x.id !== w.id), w] }); },
  deleteMaintenance(id: string) { set({ ...state, maintenance: state.maintenance.filter((x) => x.id !== id) }); },
  setEscalation(e: Escalation) { set({ ...state, escalation: e }); },
  setAlertSort(s: State["alertSort"]) { set({ ...state, alertSort: s }); },
  setNotify(n: NotifyPrefs) { set({ ...state, notify: n }); },
  setAlerts(a: AlertConfig) { set({ ...state, alerts: a }); },
  deleteReport(id: string) { set({ ...state, reports: state.reports.filter((x) => x.id !== id) }); },
};
