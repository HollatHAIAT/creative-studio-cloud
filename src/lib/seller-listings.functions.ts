import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SellerListing = {
  id: string; title: string; titleAr: string; description: string; descriptionAr: string;
  altText: string; altTextAr: string; medium: string; tags: string[]; category: string; price: number; imageUrl: string | null; publishedAt: string | null;
};

async function load(filter: { id?: string }): Promise<SellerListing[]> {
  // Only staff-published listings are exposed; images come from a private bucket via short-lived links.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("listing_drafts")
    .select("title,title_ar,description,description_ar,alt_text,alt_text_ar,medium,tags,image_path,published_listing_id,published_at,price,category")
    .eq("status", "published").order("published_at", { ascending: false }).limit(60);
  if (filter.id) q = q.eq("published_listing_id", filter.id);
  const { data } = await q;
  return Promise.all((data ?? []).map(async (d) => ({
    id: d.published_listing_id!, title: d.title, titleAr: d.title_ar, description: d.description, descriptionAr: d.description_ar,
    altText: d.alt_text, altTextAr: d.alt_text_ar, medium: d.medium, tags: d.tags, category: d.category ?? "", price: Number(d.price ?? 0),
    publishedAt: d.published_at,
    imageUrl: d.image_path ? (await supabaseAdmin.storage.from("artwork-images").createSignedUrl(d.image_path, 3600)).data?.signedUrl ?? null : null,
  })));
}

export const listSellerListings = createServerFn({ method: "GET" }).handler(() => load({}));

export const getSellerListing = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().regex(/^sl-[a-f0-9]{10}$/) }).parse(d))
  .handler(async ({ data }) => (await load({ id: data.id }))[0] ?? null);
