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
        ? a.data.map((x) => ({ id: x.id, name: x.name, nameAr: x.name_ar, code: x.code, color: x.color, founded: x.founded ?? 0 }))
        : saudiBanks;
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
  return { blob: await assetBlob(b, f), name: `${b.id}-placeholder.${f}` };
}
