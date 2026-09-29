import type { EvidenceEntry } from "@/lib/settings-audit-qa.functions";

export type ReportSection = { heading: string; badge?: string | undefined; body?: string | undefined; note?: string | undefined; entryIds?: string[] | undefined };
export type ReportInput = {
  title: string; subtitle: string; scope: string; summary: string; sections: ReportSection[];
  list?: { heading: string; items: string[] }; evidence: Record<string, EvidenceEntry>; ar: boolean;
  labels: Record<string, string>; t: { scope: string; generated: string; evidence: string; appendix: string; cols: string[]; foot: string };
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Opens a print-ready report (Arabic/RTL safe) and the browser's "Save as PDF" dialog. Returns false if pop-ups are blocked. */
export function exportCompliancePdf(r: ReportInput): boolean {
  const loc = r.ar ? "ar-SA" : "en-GB";
  const when = (d: string) => new Date(d).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const used = new Set(r.sections.flatMap((s) => s.entryIds ?? []));
  const rows = [...used].map((id) => r.evidence[id]).filter((e): e is EvidenceEntry => !!e).sort((a, b) => a.n - b.n);
  const chip = (id: string) => { const e = r.evidence[id]; return e ? `<a href="#ev-${esc(id)}" class="chip">#${e.n}</a>` : ""; };
  const html = `<!doctype html><html lang="${r.ar ? "ar" : "en"}" dir="${r.ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
<style>
@page{size:A4;margin:16mm}
body{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic",Arial,sans-serif;color:#1f1a14;font-size:11pt;line-height:1.5;margin:0}
h1{font-size:18pt;margin:0 0 2pt} h2{font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #c9b48a;padding-bottom:2pt}
.muted{color:#6b6255;font-size:9pt} .sec{border:1px solid #ddd2bb;border-radius:6pt;padding:8pt;margin:6pt 0;break-inside:avoid}
.badge{display:inline-block;border:1px solid #8a6d3b;border-radius:10pt;padding:0 6pt;font-size:8.5pt;margin-inline-end:6pt}
.chip{display:inline-block;border:1px solid #bbb;border-radius:8pt;padding:0 5pt;margin:1pt;font-size:8.5pt;color:#1f1a14;text-decoration:none}
table{width:100%;border-collapse:collapse;font-size:8.5pt} th,td{border:1px solid #ddd2bb;padding:3pt 4pt;text-align:start;vertical-align:top} th{background:#f4ede0}
tr{break-inside:avoid}
</style></head><body>
<h1>${esc(r.title)}</h1><p class="muted">${esc(r.subtitle)}</p>
<p class="muted">${esc(r.t.scope)}: ${esc(r.scope)} · ${esc(r.t.generated)}: ${esc(when(new Date().toISOString()))}</p>
<p>${esc(r.summary)}</p>
${r.sections.map((s) => `<div class="sec"><p><strong>${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ""}${esc(s.heading)}</strong></p>${s.body ? `<p>${esc(s.body)}</p>` : ""}${s.note ? `<p class="muted">${esc(s.note)}</p>` : ""}${s.entryIds?.length ? `<p class="muted">${esc(r.t.evidence)}: ${s.entryIds.map(chip).join(" ")}</p>` : ""}</div>`).join("")}
${r.list?.items.length ? `<h2>${esc(r.list.heading)}</h2><ul>${r.list.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
${rows.length ? `<h2>${esc(r.t.appendix)}</h2><table><thead><tr>${r.t.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((e) => `<tr id="ev-${esc(e.id)}"><td>#${e.n}</td><td>${esc(when(e.created_at))}</td><td>${esc(e.who)}</td><td>${esc(r.labels[e.field] ?? e.field)}</td><td>${esc(e.from ?? "—")}</td><td>${esc(e.to ?? "—")}</td><td style="font-family:monospace;font-size:7pt">${esc(e.id)}</td></tr>`).join("")}</tbody></table>` : ""}
<p class="muted" style="margin-top:14pt">${esc(r.t.foot)}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

export const reportText = (L: (e: string, a: string) => string) => ({
  scope: L("Scope", "النطاق"), generated: L("Generated", "أُنشئ"), evidence: L("Evidence", "الأدلة"),
  appendix: L("Evidence entries", "سجلات الأدلة"),
  cols: [L("Entry", "السجل"), L("Time", "الوقت"), L("Administrator", "المشرف"), L("Setting", "الإعداد"), L("Old", "القديمة"), L("New", "الجديدة"), L("Entry ID", "معرّف السجل")],
  foot: L("AI-generated from the Arwiqa settings Change history. Verify findings against the listed entries before relying on them.", "أُنشئ بالذكاء الاصطناعي من سجل تغييرات إعدادات أروقة. تحقّق من الملاحظات مقابل السجلات المذكورة قبل الاعتماد عليها."),
});
