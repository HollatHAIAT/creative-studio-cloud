import type { Bank } from "@/lib/data";
import { svgDataUrl } from "@/lib/bank-assets";
import { useLocale } from "@/lib/i18n";

export function BankTile({ b, selected, onToggle }: { b: Bank; selected?: boolean; onToggle?: () => void }) {
  const { t, pick } = useLocale();
  const body = (
    <>
      <img src={b.preview || svgDataUrl(b)} alt={b.preview ? (pick(b, "description") || b.name) : `${b.name} — ${t("banks.placeholder")}`} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
      <p className="mt-2 font-display text-lg leading-tight">{pick(b, "name")}</p>
      <p className="text-xs text-muted-foreground">{b.preview ? (b.category ? pick(b, "category") : "") : t("banks.placeholder")}</p>
    </>
  );
  if (!onToggle) return <div className="rounded-sm border border-border bg-card p-3">{body}</div>;
  return (
    <label className={`relative block cursor-pointer rounded-sm border-2 bg-card p-3 ${selected ? "border-primary" : "border-border"}`}>
      <input type="checkbox" checked={!!selected} onChange={onToggle} className="absolute start-4 top-4 h-5 w-5 accent-primary" aria-label={b.name} />
      {body}
    </label>
  );
}
