import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { BankTile } from "@/components/BankTile";
import { supabase } from "@/integrations/supabase/client";
import { saudiBanks } from "@/lib/data";
import { FORMATS, save, svgDataUrl, type AssetFormat } from "@/lib/bank-assets";
import { BUCKET, resolveBlob, useAssets, type AssetFile } from "@/lib/assets-db";
import { useSession, useStaff } from "@/lib/auth";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/assets/$id")({
  head: ({ params }) => {
    const b = saudiBanks.find((x) => x.id === params.id);
    const title = b ? `${b.name} digital assets — creativestudio` : "Digital asset — creativestudio";
    return { meta: [
      { title }, { name: "description", content: `Download ${b?.name ?? "asset"} files in PNG, JPG, SVG or PDF with license details.` },
      { property: "og:title", content: title }, { property: "og:description", content: "Free digital asset files and license details." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: AssetPage,
});

const MIME: Record<AssetFormat, string[]> = { png: ["image/png"], jpg: ["image/jpeg"], svg: ["image/svg+xml"], pdf: ["application/pdf"] };
const MAX = 50 * 1024 * 1024;

function Preview({ file }: { file: AssetFile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    supabase.storage.from(BUCKET).download(file.storage_path).then(({ data }) => { if (data) { u = URL.createObjectURL(data); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [file.storage_path, file.updated_at]);
  if (!url) return <div className="aspect-square animate-pulse rounded-sm bg-muted" />;
  return file.format === "pdf" ? <iframe title={file.file_name} src={url} className="aspect-square w-full rounded-sm border border-border" /> : <img src={url} alt={file.file_name} className="aspect-square w-full rounded-sm object-contain bg-muted" />;
}

function AssetPage() {
  const { id } = Route.useParams();
  const { t, pick } = useLocale();
  const { user } = useSession();
  const { isAdmin } = useStaff();
  const q = useAssets();
  const qc = useQueryClient();
  const b = q.data?.banks.find((x) => x.id === id);
  const files = (q.data?.files ?? []).filter((f) => f.asset_id === id);

  const upload = useMutation({
    mutationFn: async ({ format, file }: { format: AssetFormat; file: File }) => {
      if (file.size > MAX) throw new Error("Max 50 MB");
      if (!MIME[format].includes(file.type)) throw new Error(`Expected ${format.toUpperCase()} file`);
      const existing = files.find((f) => f.format === format);
      const path = `${id}/${format}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(0, 80)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const row = { asset_id: id, format, storage_path: path, file_name: file.name.slice(0, 120), size_bytes: file.size, content_type: file.type, uploaded_by: user?.id ?? null, updated_at: new Date().toISOString() };
      const db = existing ? await supabase.from("asset_files").update(row).eq("id", existing.id) : await supabase.from("asset_files").insert(row);
      if (db.error) { await supabase.storage.from(BUCKET).remove([path]); throw db.error; }
      if (existing) await supabase.storage.from(BUCKET).remove([existing.storage_path]);
    },
    onSuccess: () => { toast.success(t("asset.uploaded")); qc.invalidateQueries({ queryKey: ["assets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (f: AssetFile) => {
      const s = await supabase.storage.from(BUCKET).remove([f.storage_path]);
      if (s.error) throw s.error;
      const d = await supabase.from("asset_files").delete().eq("id", f.id);
      if (d.error) throw d.error;
    },
    onSuccess: () => { toast.success(t("asset.deleted")); qc.invalidateQueries({ queryKey: ["assets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!b) return <SiteShell><p className="p-16 text-center">{q.isLoading ? "…" : "Not found"}</p></SiteShell>;
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-12 md:grid-cols-3">
        <div><BankTile b={b} /><Link to="/collections/saudi-banks" className="mt-3 inline-block text-sm underline">← {t("banks.title")}</Link></div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-primary">{t("banks.eyebrow")}</p>
          <h1 className="font-display text-5xl">{pick(b, "name")}</h1>
          <p className="mt-3 text-sm">{t("banks.licenseText")}</p>
          <h2 className="mt-8 font-display text-2xl">{t("asset.files")}</h2>
          {!isAdmin && <p className="text-xs text-muted-foreground">{t("asset.adminOnly")}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FORMATS.map((format) => {
              const f = files.find((x) => x.format === format);
              return (
                <div key={format} className="rounded-sm border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between"><p className="font-display text-xl">{format.toUpperCase()}</p>
                    <button onClick={async () => { const r = await resolveBlob(b, format, q.data?.files ?? []); save(r.blob, r.name); }} className="text-sm underline">{t("banks.download")}</button></div>
                  {f ? <Preview file={f} /> : <img src={svgDataUrl(b)} alt="" className="aspect-square w-full rounded-sm object-cover opacity-60" />}
                  <p className="mt-2 text-xs text-muted-foreground">{f ? `${f.file_name} · ${(f.size_bytes / 1024).toFixed(0)} KB` : t("asset.noFile")}</p>
                  {f && <p className="break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{t("asset.path")}: {f.storage_path}</p>}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <label className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs">
                        {f ? t("asset.replace") : t("asset.upload")}
                        <input type="file" accept={MIME[format].join(",")} className="hidden" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload.mutate({ format, file }); }} />
                      </label>
                      {f && <button onClick={() => remove.mutate(f)} className="rounded-full border border-destructive px-3 py-1.5 text-xs text-destructive">{t("asset.delete")}</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
