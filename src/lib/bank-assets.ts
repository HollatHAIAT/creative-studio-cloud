import type { Bank } from "./data";

/** Placeholder artwork. Intentionally labelled so it is never mistaken for an official logo. */
export function bankSvg(b: Bank) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<rect width="800" height="800" fill="#f6f1e7"/>
<circle cx="400" cy="300" r="170" fill="${b.color}"/>
<text x="400" y="330" font-family="Georgia, serif" font-size="${b.code.length > 3 ? 90 : 110}" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(b.code)}</text>
<text x="400" y="560" font-family="Georgia, serif" font-size="44" fill="#1f1a14" text-anchor="middle">${esc(b.name)}</text>
<text x="400" y="625" font-family="Tahoma, sans-serif" font-size="42" fill="#1f1a14" text-anchor="middle" direction="rtl">${esc(b.nameAr)}</text>
<text x="400" y="740" font-family="Arial, sans-serif" font-size="22" fill="#8a7f70" text-anchor="middle">PLACEHOLDER — NOT THE OFFICIAL LOGO · creativestudio</text>
</svg>`;
}
export const svgDataUrl = (b: Bank) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bankSvg(b))}`;

export type AssetFormat = "png" | "jpg" | "svg" | "pdf";
export const FORMATS: AssetFormat[] = ["png", "jpg", "svg", "pdf"];

async function raster(b: Bank, type: "image/png" | "image/jpeg"): Promise<Blob> {
  const img = new Image();
  img.src = svgDataUrl(b);
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 1600; c.height = 1600;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f6f1e7"; ctx.fillRect(0, 0, 1600, 1600);
  ctx.drawImage(img, 0, 0, 1600, 1600);
  return new Promise((res) => c.toBlob((bl) => res(bl!), type, 0.92));
}

export async function assetBlob(b: Bank, f: AssetFormat): Promise<Blob> {
  if (f === "svg") return new Blob([bankSvg(b)], { type: "image/svg+xml" });
  if (f === "png") return raster(b, "image/png");
  if (f === "jpg") return raster(b, "image/jpeg");
  const { jsPDF } = await import("jspdf");
  const png = await raster(b, "image/png");
  const url = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(png); });
  const doc = new jsPDF({ unit: "pt", format: [600, 600] });
  doc.addImage(url, "PNG", 0, 0, 600, 600);
  return doc.output("blob");
}

export const fileName = (b: Bank, f: AssetFormat) => `${b.id}-placeholder.${f}`;

export function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function metadataCsv(banks: Bank[], f: AssetFormat) {
  const rows = [["id", "name_en", "name_ar", "code", "founded", "file", "format", "license", "price", "official_logo"],
    ...banks.map((b) => [b.id, b.name, b.nameAr, b.code, String(b.founded), fileName(b, f), f.toUpperCase(), "Free — editorial/personal; commercial needs trademark owner permission", "0", "no (placeholder)"])];
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function zip(banks: Bank[], f: AssetFormat) {
  const JSZip = (await import("jszip")).default;
  const z = new JSZip();
  for (const b of banks) z.file(fileName(b, f), await assetBlob(b, f));
  z.file("metadata.csv", metadataCsv(banks, f));
  z.file("LICENSE.txt", "Placeholder graphics by creativestudio. These are NOT official bank logos.\nFree for editorial and personal use. Trademarks belong to their respective owners; commercial use requires the owner's permission.\n");
  return z.generateAsync({ type: "blob" });
}
