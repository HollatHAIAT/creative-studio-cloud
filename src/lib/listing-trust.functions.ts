import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ListingTrust = {
  found: boolean;
  sellerRole: string | null;
  ownerDeclared: boolean;
  ownerApprovedAt: string | null;
  coOwners: number;
  isHeritage: boolean;
  heritageType: string | null;
  region: string | null;
  era: string | null;
  provenance: { period: string; documented: boolean }[];
  conditionGrade: string | null;
  conditionReport: string | null;
  exportPermit: string | null; // masked
};

const EMPTY: ListingTrust = { found: false, sellerRole: null, ownerDeclared: false, ownerApprovedAt: null, coOwners: 0, isHeritage: false, heritageType: null, region: null, era: null, provenance: [], conditionGrade: null, conditionReport: null, exportPermit: null };

/** Public: trust facts for a live listing. Only public-safe fields — no owner names, emails or previous holders. */
export const getListingTrust = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<ListingTrust> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: live } = await sb.from("listings").select("id").eq("id", data.id).eq("status", "published").maybeSingle();
    if (!live) return EMPTY;
    const { data: d } = await sb.from("listing_drafts")
      .select("seller_role,owner_declared,owner_approved_at,co_owners,is_heritage,heritage_type,origin_region,era,provenance,condition_grade,condition_report,export_permit_ref")
      .eq("published_listing_id", data.id).eq("status", "published").maybeSingle();
    if (!d) return EMPTY;
    const ref = String(d.export_permit_ref ?? "").trim();
    return {
      found: true,
      sellerRole: d.seller_role ?? null,
      ownerDeclared: !!d.owner_declared,
      ownerApprovedAt: d.owner_approved_at ?? null,
      coOwners: Array.isArray(d.co_owners) ? d.co_owners.length : 0,
      isHeritage: !!d.is_heritage,
      heritageType: d.heritage_type || null,
      region: d.origin_region || null,
      era: d.era || null,
      provenance: (Array.isArray(d.provenance) ? d.provenance : []).filter((p: any) => p?.period).slice(0, 20)
        .map((p: any) => ({ period: String(p.period).slice(0, 80), documented: !!String(p.evidence ?? "").trim() })),
      conditionGrade: d.condition_grade || null,
      conditionReport: d.condition_report ? String(d.condition_report).slice(0, 1500) : null,
      exportPermit: ref ? (ref.length > 4 ? `••••${ref.slice(-4)}` : "••••") : null,
    };
  });
