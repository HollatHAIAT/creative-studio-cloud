import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { saudiBanks, type Bank } from "./data";
import { assetBlob, type AssetFormat } from "./bank-assets";

export const BUCKET = "digital-downloads";
export type AssetFile = { id: string; asset_id: string; format: string; storage_path: string; file_name: string; size_bytes: number; content_type: string | null; updated_at: string };

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const [a, f] = await Promise.all([
        supabase.from("digital_assets").select("*").order("sort"),
        supabase.from("asset_files").select("*"),
      ]);
      const banks: Bank[] = a.data?.length
        ? a.data.map((x) => ({ id: x.id, name: x.name, nameAr: x.name_ar, code: x.code, color: x.color, founded: x.founded ?? 0, collection: x.collection, category: x.category, categoryAr: x.category_ar, tags: x.tags ?? [], description: x.description ?? undefined, descriptionAr: x.description_ar ?? undefined, preview: x.preview_url, kind: x.kind }))
        : saudiBanks.map((b) => ({ ...b, collection: "saudi-banks", category: "Logos", categoryAr: "شعارات", tags: ["bank", "saudi", "logo"], kind: "logo" }));
      return { banks, files: (f.data ?? []) as AssetFile[] };
    },
  });
}

/** Uploaded file when one exists for this format; otherwise the generated placeholder. */
export async function resolveBlob(b: Bank, f: AssetFormat, files: AssetFile[]): Promise<{ blob: Blob; name: string }> {
  const up = files.find((x) => x.asset_id === b.id && x.format === f);
  if (up) {
    const { data, error } = await supabase.storage.from(BUCKET).download(up.storage_path);
    if (!error && data) return { blob: data, name: up.file_name };
  }
  if (b.preview) {
    const res = await fetch(b.preview);
    if (res.ok) { const blob = await res.blob(); return { blob, name: `${b.id}.${b.preview.split(".").pop()}` }; }
  }
  return { blob: await assetBlob(b, f), name: `${b.id}-placeholder.${f}` };
}
