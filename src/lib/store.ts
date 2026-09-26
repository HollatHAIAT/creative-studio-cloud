import { useSyncExternalStore } from "react";
import { defaultAlertConfig, type AlertConfig } from "./analytics";
import { seedListings, toArtwork, type Listing, type ListingStatus } from "./data";

// Demo persistence in the browser; to be replaced by Lovable Cloud with accounts.
export type SavedView = { id: string; name: string; days: number; category: string; status: string };
export type Report = { id: string; name: string; frequency: "weekly" | "monthly"; weekday: number; monthday: number; time: string; timezone: string; email: string; paused: boolean; includeSources: boolean;
  metrics?: ReportMetric[]; sources?: string[]; history?: Delivery[] };
export type ReportMetric = "views" | "favorites" | "purchases" | "conversion" | "top";
export type Delivery = { id: string; at: string; status: "sent" | "failed" | "upcoming" | "retrying"; error?: string };
type State = { mine: Listing[]; removed: string[]; favorites: string[]; views: SavedView[]; reports: Report[]; alerts: AlertConfig; review: Record<string, "acknowledged" | "resolved">; notify: NotifyPrefs; alertSort: { by: "latest" | "repeats" | "drop" | "duration" | "ongoing"; dir: "desc" | "asc" }; alertPresets: AlertPreset[] };
export type AlertPreset = { id: string; name: string; listing: string; metric: string; status: string; from: string; to: string; recovery?: string };
export type NotifyPrefs = { inApp: boolean; email: boolean; address: string; digest: "instant" | "daily" };
const KEY = "creativestudio:v1";
const empty: State = { mine: [], removed: [], favorites: [], views: [], reports: [], alerts: defaultAlertConfig, review: {}, notify: { inApp: true, email: false, address: "", digest: "instant" }, alertSort: { by: "latest", dir: "desc" }, alertPresets: [] };
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

export const actions = {
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
  setReview(key: string, v: "acknowledged" | "resolved" | null) { const r = { ...state.review }; if (v) r[key] = v; else delete r[key]; set({ ...state, review: r }); },
  setReviewMany(keys: string[], v: "acknowledged" | "resolved") {
    const prev = state.review;
    const r = { ...prev }; keys.forEach((k) => { r[k] = v; });
    set({ ...state, review: r });
    return () => set({ ...state, review: prev });
  },
  saveAlertPreset(p: AlertPreset) { set({ ...state, alertPresets: [...state.alertPresets, p] }); },
  deleteAlertPreset(id: string) { set({ ...state, alertPresets: state.alertPresets.filter((x) => x.id !== id) }); },
  setAlertSort(s: State["alertSort"]) { set({ ...state, alertSort: s }); },
  setNotify(n: NotifyPrefs) { set({ ...state, notify: n }); },
  setAlerts(a: AlertConfig) { set({ ...state, alerts: a }); },
  deleteReport(id: string) { set({ ...state, reports: state.reports.filter((x) => x.id !== id) }); },
};
