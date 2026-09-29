import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { artists, categories, exhibitions, type Creator, type Exhibition } from "./data";

export type CmsKind = "text" | "artist" | "category" | "exhibition" | "banner";
export type CmsRow = { kind: CmsKind; key: string; data: any; published: boolean; sort: number; updated_at?: string };
export type Banner = { key: string; title: string; titleAr: string; body: string; bodyAr: string; image: string; link: string; cta: string; ctaAr: string };

// Snapshots of the built-in content, so edits and deletions can always be re-applied from a clean base.
const baseArtists: Creator[] = artists.map((a) => ({ ...a }));
const baseExhibitions: Exhibition[] = exhibitions.map((e) => ({ ...e }));
const baseCategories = [...categories] as string[];
export const builtIn = { artists: baseArtists, exhibitions: baseExhibitions, categories: baseCategories };

export const textOverrides: { en: Record<string, string>; ar: Record<string, string> } = { en: {}, ar: {} };
export let banners: Banner[] = [];

let version = 0;
const subs = new Set<() => void>();
export function useCmsVersion() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
}

const clean = (o: Record<string, any>): any => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));

/** Rebuilds live content from the built-in base plus published CMS rows, then re-renders every text/data reader. */
export function applyCms(rows: CmsRow[]) {
  const pub = rows.filter((r) => r.published).sort((a, b) => a.sort - b.sort);
  textOverrides.en = {}; textOverrides.ar = {};
  for (const r of pub.filter((r) => r.kind === "text")) {
    if (r.data.en) textOverrides.en[r.key] = String(r.data.en);
    if (r.data.ar) textOverrides.ar[r.key] = String(r.data.ar);
  }
  // Artists
  artists.splice(0, artists.length, ...baseArtists.map((a) => ({ ...a })));
  for (const r of rows.filter((r) => r.kind === "artist")) {
    const i = artists.findIndex((a) => a.id === r.key);
    if (!r.published) { if (i >= 0) artists.splice(i, 1); continue; }
    const d = clean(r.data);
    if (i >= 0) Object.assign(artists[i]!, d);
    else artists.push({ id: r.key, name: "", nameAr: "", city: "", cityAr: "", discipline: "", disciplineAr: "", image: "", bio: "", bioAr: "", followers: 0, ...d } as Creator);
  }
  // Categories
  const cats = categories as unknown as string[];
  cats.splice(0, cats.length, ...baseCategories);
  for (const r of rows.filter((r) => r.kind === "category")) {
    const i = cats.indexOf(r.key);
    if (!r.published) { if (i >= 0) cats.splice(i, 1); continue; }
    if (i < 0) cats.push(r.key);
    if (r.data.en) textOverrides.en[`cat.${r.key}`] = String(r.data.en);
    if (r.data.ar) textOverrides.ar[`cat.${r.key}`] = String(r.data.ar);
  }
  // Exhibitions
  exhibitions.splice(0, exhibitions.length, ...baseExhibitions.map((e) => ({ ...e })));
  for (const r of rows.filter((r) => r.kind === "exhibition")) {
    const i = exhibitions.findIndex((e) => e.id === r.key);
    if (!r.published) { if (i >= 0) exhibitions.splice(i, 1); continue; }
    const d = clean(r.data);
    if (typeof d.slots === "string") d.slots = d.slots.split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const n of ["capacity", "days", "startDay"]) if (d[n] != null) d[n] = Number(d[n]);
    if (d.startDate) { d.startDay = Math.round((new Date(d.startDate).getTime() - new Date(new Date().toDateString()).getTime()) / 86400_000); delete d.startDate; }
    if (d.adultPrice != null) { const p = Number(d.adultPrice); d.tickets = [{ id: "adult", price: p }, ...(p > 0 ? [{ id: "student", price: Math.round(p / 2) }] : [])]; delete d.adultPrice; }
    if (i >= 0) Object.assign(exhibitions[i]!, d);
    else exhibitions.push({ id: r.key, title: "", titleAr: "", type: "Physical", venue: "", venueAr: "", image: "", startDay: 0, days: 30, slots: ["10:00", "14:00", "18:00"], capacity: 40,
      tickets: [{ id: "adult", price: 0 }], description: "", descriptionAr: "", rooms: [{ id: "a", name: "Main hall", nameAr: "القاعة الرئيسية", x: 10, y: 10, w: 380, h: 220, works: [] }], ...d } as Exhibition);
  }
  banners = pub.filter((r) => r.kind === "banner").map((r) => ({ key: r.key, title: "", titleAr: "", body: "", bodyAr: "", image: "", link: "", cta: "", ctaAr: "", ...r.data }));
  version++; subs.forEach((f) => f());
}

export const cmsQuery = { queryKey: ["cms"], queryFn: async () => {
  const { data, error } = await supabase.from("cms_entries" as never).select("kind,key,data,published,sort,updated_at").order("sort");
  if (error) throw error;
  return (data ?? []) as unknown as CmsRow[];
} };

/** Mounted once in __root: loads site content and applies it everywhere. */
export function CmsSync() {
  const q = useQuery(cmsQuery);
  useEffect(() => { if (q.data) applyCms(q.data); }, [q.data]);
  return null;
}
