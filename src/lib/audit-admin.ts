import { supabase } from "@/integrations/supabase/client";

/** Calls a staff-gated audit RPC (all checks happen in the database). */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error((error as { message: string }).message);
  return data as T;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function toCsv(headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n#]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

/** Printable HTML; the server inserts the watermark after <body>. */
export function toPdfHtml(o: { title: string; ar: boolean; summary: [string, string][]; headers: string[]; rows: unknown[][] }): string {
  return `<!doctype html><html lang="${o.ar ? "ar" : "en"}" dir="${o.ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic",Arial,sans-serif;font-size:9pt;color:#1f1a14}
h1{font-size:15pt;margin:0 0 6pt}dl{display:grid;grid-template-columns:max-content 1fr;gap:2pt 10pt;margin:0 0 10pt}dt{font-weight:600}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd2bb;padding:3pt;text-align:start;vertical-align:top;word-break:break-word}th{background:#f4ede0}tr{break-inside:avoid}</style></head><body>
<h1>${esc(o.title)}</h1><dl>${o.summary.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<table><thead><tr>${o.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${o.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(typeof c === "object" && c ? JSON.stringify(c) : c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
}

/** Fetches a registered export (logged, blocked after expiry) and opens/saves it. */
export async function downloadExport(id: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await rpc<{ ok: boolean; reason?: string; format?: string; kind?: string; content?: string }>("admin_export_download", { _id: id });
  if (!r.ok || !r.content) return { ok: false, reason: r.reason ?? "FAILED" };
  if (r.format === "csv") {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + r.content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `arwiqa-${r.kind}-${id.slice(0, 8)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } else {
    const w = window.open("", "_blank"); if (!w) return { ok: false, reason: "POPUP_BLOCKED" };
    w.document.open(); w.document.write(r.content); w.document.close();
  }
  return { ok: true };
}

/** Registers an export server-side (audited, watermarked, expiring) then downloads it. */
export async function secureExport(kind: "incidents" | "audit" | "chart", format: "csv" | "pdf", filters: Record<string, unknown>, content: string, rows: number) {
  const id = await rpc<string>("admin_export_create", { _kind: kind, _format: format, _filters: filters, _content: content, _rows: rows });
  return downloadExport(id);
}

export const fmtDate = (d: string | null | undefined, ar: boolean) => d ? new Date(d).toLocaleString(ar ? "ar-SA-u-ca-gregory" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
export const sevClass: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground", high: "bg-destructive/15 text-destructive", medium: "bg-accent text-accent-foreground", low: "bg-muted text-muted-foreground",
};
export const SEV_AR: Record<string, string> = { critical: "حرجة", high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };
export const STATUS_AR: Record<string, string> = { open: "مفتوحة", acknowledged: "مؤكَّدة", assigned: "مُسندة", investigating: "قيد المعالجة", resolved: "تمت المعالجة", closed: "مغلقة" };
