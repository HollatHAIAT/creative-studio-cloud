import { useSyncExternalStore } from "react";
import { seedListings, toArtwork, type Listing } from "./data";

// Demo persistence in the browser; to be replaced by Lovable Cloud with accounts.
type State = { mine: Listing[]; removed: string[]; favorites: string[] };
const KEY = "creativestudio:v1";
const empty: State = { mine: [], removed: [], favorites: [] };
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
export function useListings() {
  const s = useStore();
  const seed = seedListings.filter((l) => !s.removed.includes(l.id) && !s.mine.some((m) => m.id === l.id));
  return [...s.mine, ...seed].map(toArtwork);
}
export const DEMO_CREATOR = "layla-haddad";

export const actions = {
  toggleFavorite(id: string) {
    const f = state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
    set({ ...state, favorites: f });
  },
  save(l: Listing) { set({ ...state, mine: [l, ...state.mine.filter((m) => m.id !== l.id)] }); },
  remove(id: string) {
    set({ ...state, mine: state.mine.filter((m) => m.id !== id), removed: [...state.removed, id], favorites: state.favorites.filter((x) => x !== id) });
  },
};
