import { useEffect, useState } from "react";

const KEY = "arwiqa:recent";
const MAX = 12;

/** Remembers artwork ids the visitor opened, on this device only. */
export function trackView(id: string) {
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    localStorage.setItem(KEY, JSON.stringify([id, ...prev.filter((x) => x !== id)].slice(0, MAX)));
    window.dispatchEvent(new Event("arwiqa:recent"));
  } catch { /* storage unavailable */ }
}

/** Read after hydration to avoid server/client mismatch. */
export function useRecentlyViewed(exclude?: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const read = () => { try { setIds(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { setIds([]); } };
    read(); window.addEventListener("arwiqa:recent", read); window.addEventListener("storage", read);
    return () => { window.removeEventListener("arwiqa:recent", read); window.removeEventListener("storage", read); };
  }, []);
  return ids.filter((x) => x !== exclude);
}
