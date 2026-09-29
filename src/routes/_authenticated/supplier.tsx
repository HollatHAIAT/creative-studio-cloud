import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Package, ClipboardList, Plus, AlertTriangle } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { supplyTypes, fmt } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/supplier")({
  head: () => ({ meta: [
    { title: "Supplier portal — Arwiqa أروقة" }, { name: "description", content: "Manage your art-supplies shop: account, products, stock and orders." },
    { property: "og:title", content: "Supplier portal — Arwiqa أروقة" }, { property: "og:description", content: "Sell paints, brushes and craft materials on Arwiqa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: SupplierPortal,
});

const sb = supabase as any;
type Acc = { name: string; name_ar: string; city: string; city_ar: string; phone: string; email: string; about: string; about_ar: string; status?: string };
type Prod = { id?: string; name: string; name_ar: string; description: string; description_ar: string; type: string; price: number; stock: number; low_stock_at: number; swatch: string; status: string };
type Line = { id: string; order_id: string; title: string; title_ar: string; qty: number; amount: number; ship_to: any; buyer_name: string; status: string; tracking: string; created_at: string };
const EMPTY_ACC: Acc = { name: "", name_ar: "", city: "", city_ar: "", phone: "", email: "", about: "", about_ar: "" };
const EMPTY_PROD: Prod = { name: "", name_ar: "", description: "", description_ar: "", type: "paint", price: 10, stock: 10, low_stock_at: 3, swatch: "#b0643a", status: "draft" };
const input = "mt-1 w-full rounded-md border border-border bg-background p-2";
const card = "rounded-md border border-border bg-card p-6";
const TYPE_AR: Record<string, string> = { paint: "ألوان", brush: "فرش", canvas: "كانفس", calligraphy: "خط عربي", clay: "طين وفخار", textile: "نسيج" };
const STATUS: Record<string, [string, string]> = { new: ["New", "جديد"], preparing: ["Preparing", "قيد التجهيز"], shipped: ["Shipped", "تم الشحن"], delivered: ["Delivered", "تم التسليم"], cancelled: ["Cancelled", "ملغى"],
  draft: ["Draft", "مسودة"], published: ["Published", "منشور"], archived: ["Archived", "مؤرشف"] };

const st = (k?: string): [string, string] => STATUS[k ?? ""] ?? [k ?? "", k ?? ""];

function SupplierPortal() {
  const { locale } = useLocale(); const ar = locale === "ar";
  const L = (e: string, a: string) => (ar ? a : e);
  const [tab, setTab] = useState<"orders" | "products" | "account">("orders");
  const acc = useQuery({ queryKey: ["supplier-account"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await sb.from("supplier_accounts").select("*").eq("user_id", u.user!.id).maybeSingle();
    return { uid: u.user!.id, email: u.user!.email ?? "", account: data as (Acc & { status: string }) | null };
  } });
  if (acc.isLoading) return <SiteShell><p className="p-10 text-center text-muted-foreground">…</p></SiteShell>;
  const a = acc.data?.account;
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Suppliers", "الموردون")} title={L("Supplier portal", "بوابة الموردين")} sub={a ? (ar ? a.name_ar || a.name : a.name) : L("Sell paints, brushes, canvas, qalam, clay and textiles to artists across the Kingdom.", "بِع الألوان والفرش والكانفس والأقلام والطين والنسيج لفناني المملكة.")} />
      <div className="mx-auto max-w-6xl px-6 pb-20">
        {!a ? <AccountForm L={L} uid={acc.data!.uid} email={acc.data!.email} initial={null} /> : (
          <>
            {a.status === "suspended" && <p role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertTriangle aria-hidden className="h-4 w-4" />{L("Your supplier account is suspended. Your products are hidden. Contact support.", "حساب المورّد موقوف وتم إخفاء منتجاتك. تواصل مع الدعم.")}</p>}
            <nav aria-label={L("Portal sections", "أقسام البوابة")} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
              {([["orders", L("Orders", "الطلبات"), ClipboardList], ["products", L("Products & stock", "المنتجات والمخزون"), Package], ["account", L("Account", "الحساب"), Store]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm ${tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}><Icon aria-hidden className="h-4 w-4" />{label}</button>
              ))}
            </nav>
            {tab === "orders" ? <Orders L={L} ar={ar} /> : tab === "products" ? <Products L={L} ar={ar} /> : <AccountForm L={L} uid={acc.data!.uid} email={acc.data!.email} initial={a} />}
          </>
        )}
      </div>
    </SiteShell>
  );
}

function AccountForm({ L, uid, email, initial }: { L: (e: string, a: string) => string; uid: string; email: string; initial: Acc | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Acc>(initial ?? { ...EMPTY_ACC, email });
  const set = (k: keyof Acc) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (f.name.trim().length < 2) { toast.error(L("Enter your shop name.", "أدخل اسم المتجر.")); return; }
    const row = { user_id: uid, name: f.name.trim(), name_ar: f.name_ar.trim(), city: f.city.trim(), city_ar: f.city_ar.trim(), phone: f.phone.trim(), email: f.email.trim(), about: f.about.trim(), about_ar: f.about_ar.trim() };
    const { error } = initial ? await sb.from("supplier_accounts").update(row).eq("user_id", uid) : await sb.from("supplier_accounts").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? L("Account saved", "تم حفظ الحساب") : L("Welcome! Your supplier account is ready.", "أهلًا! حساب المورّد جاهز.")); qc.invalidateQueries({ queryKey: ["supplier-account"] });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className={card}>
      <h2 className="font-display text-2xl">{initial ? L("Shop details", "بيانات المتجر") : L("Open your supplier account", "افتح حساب مورّد")}</h2>
      {!initial && <p className="mt-1 text-sm text-muted-foreground">{L("Tell buyers who you are. You can add products right after.", "عرّف المشترين بنفسك، ثم أضف منتجاتك مباشرة.")}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">{L("Shop name (English)", "اسم المتجر (إنجليزي)")}<input dir="ltr" required maxLength={120} value={f.name} onChange={set("name")} className={input} /></label>
        <label className="text-sm">{L("Shop name (Arabic)", "اسم المتجر (عربي)")}<input dir="rtl" maxLength={120} value={f.name_ar} onChange={set("name_ar")} className={input} /></label>
        <label className="text-sm">{L("City (English)", "المدينة (إنجليزي)")}<input dir="ltr" maxLength={80} value={f.city} onChange={set("city")} className={input} /></label>
        <label className="text-sm">{L("City (Arabic)", "المدينة (عربي)")}<input dir="rtl" maxLength={80} value={f.city_ar} onChange={set("city_ar")} className={input} /></label>
        <label className="text-sm">{L("Phone", "الجوال")}<input dir="ltr" type="tel" maxLength={30} value={f.phone} onChange={set("phone")} className={input} /></label>
        <label className="text-sm">{L("Orders email", "بريد الطلبات")}<input dir="ltr" type="email" maxLength={255} value={f.email} onChange={set("email")} className={input} /></label>
        <label className="text-sm">{L("About (English)", "نبذة (إنجليزي)")}<textarea dir="ltr" rows={3} maxLength={1500} value={f.about} onChange={set("about")} className={input} /></label>
        <label className="text-sm">{L("About (Arabic)", "نبذة (عربي)")}<textarea dir="rtl" rows={3} maxLength={1500} value={f.about_ar} onChange={set("about_ar")} className={input} /></label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{L("Bank payouts use the account in", "تُحوَّل المبالغ إلى الحساب البنكي في")} <Link to="/profile" className="underline">{L("My profile", "ملفي الشخصي")}</Link>.</p>
      <button className="mt-4 rounded-md bg-primary px-5 py-2 text-primary-foreground">{initial ? L("Save", "حفظ") : L("Create supplier account", "إنشاء حساب المورّد")}</button>
    </form>
  );
}

function Products({ L, ar }: { L: (e: string, a: string) => string; ar: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["supplier-products-mine"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await sb.from("supplier_products").select("*").eq("supplier_id", u.user!.id).order("created_at", { ascending: false });
    if (error) throw error; return data as Prod[];
  } });
  const [edit, setEdit] = useState<Prod | null>(null);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const refresh = () => { qc.invalidateQueries({ queryKey: ["supplier-products-mine"] }); qc.invalidateQueries({ queryKey: ["supplier-products-public"] }); };
  const save = async () => {
    if (!edit) return;
    if (edit.name.trim().length < 2 || edit.name_ar.trim().length < 2) { toast.error(L("Add the product name in both languages.", "أضف اسم المنتج باللغتين.")); return; }
    if (!(edit.price > 0)) { toast.error(L("Price must be above zero.", "السعر يجب أن يكون أكبر من صفر.")); return; }
    const { id, ...rest } = edit;
    const row = { ...rest, name: rest.name.trim(), name_ar: rest.name_ar.trim(), price: Number(rest.price), stock: Math.max(0, Math.floor(Number(rest.stock))), low_stock_at: Math.max(0, Math.floor(Number(rest.low_stock_at))) };
    const { error } = id ? await sb.from("supplier_products").update(row).eq("id", id) : await sb.from("supplier_products").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(L("Product saved", "تم حفظ المنتج")); setEdit(null); refresh();
  };
  const patch = async (id: string, p: Partial<Prod>, msg: string) => { const { error } = await sb.from("supplier_products").update(p).eq("id", id); if (error) toast.error(error.message); else { toast.success(msg); refresh(); } };
  const del = async (id: string) => { if (!confirm(L("Delete this product? Past orders keep their details.", "حذف المنتج؟ تبقى تفاصيل الطلبات السابقة."))) return; const { error } = await sb.from("supplier_products").delete().eq("id", id); if (error) toast.error(error.message); else refresh(); };
  const n = (k: keyof Prod) => (e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit!, [k]: Number(e.target.value) });
  const t = (k: keyof Prod) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setEdit({ ...edit!, [k]: e.target.value });

  if (edit) return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className={card}>
      <h2 className="font-display text-2xl">{edit.id ? L("Edit product", "تعديل المنتج") : L("New product", "منتج جديد")}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">{L("Name (English)", "الاسم (إنجليزي)")}<input dir="ltr" required maxLength={160} value={edit.name} onChange={t("name")} className={input} /></label>
        <label className="text-sm">{L("Name (Arabic)", "الاسم (عربي)")}<input dir="rtl" required maxLength={160} value={edit.name_ar} onChange={t("name_ar")} className={input} /></label>
        <label className="text-sm">{L("Description (English)", "الوصف (إنجليزي)")}<textarea dir="ltr" rows={3} maxLength={1500} value={edit.description} onChange={t("description")} className={input} /></label>
        <label className="text-sm">{L("Description (Arabic)", "الوصف (عربي)")}<textarea dir="rtl" rows={3} maxLength={1500} value={edit.description_ar} onChange={t("description_ar")} className={input} /></label>
        <label className="text-sm">{L("Type", "النوع")}<select value={edit.type} onChange={t("type")} className={input}>{supplyTypes.map((x) => <option key={x} value={x}>{ar ? TYPE_AR[x] : x}</option>)}</select></label>
        <label className="text-sm">{L("Price (SAR, before VAT)", "السعر (ريال، قبل الضريبة)")}<input type="number" min={0.5} step={0.5} value={edit.price} onChange={n("price")} className={input} /></label>
        <label className="text-sm">{L("In stock", "الكمية المتوفرة")}<input type="number" min={0} step={1} value={edit.stock} onChange={n("stock")} className={input} /></label>
        <label className="text-sm">{L("Alert me when stock reaches", "نبّهني عندما يصل المخزون إلى")}<input type="number" min={0} step={1} value={edit.low_stock_at} onChange={n("low_stock_at")} className={input} /></label>
        <label className="flex items-center gap-3 text-sm">{L("Colour swatch", "لون العيّنة")}<input type="color" value={edit.swatch.startsWith("#") ? edit.swatch : "#b0643a"} onChange={t("swatch")} className="h-9 w-14 rounded border border-border" /></label>
        <label className="text-sm">{L("Status", "الحالة")}<select value={edit.status} onChange={t("status")} className={input}>{["draft", "published", "archived"].map((x) => <option key={x} value={x}>{L(st(x)[0], st(x)[1])}</option>)}</select></label>
      </div>
      <div className="mt-5 flex gap-3"><button className="rounded-md bg-primary px-5 py-2 text-primary-foreground">{L("Save product", "حفظ المنتج")}</button><button type="button" onClick={() => setEdit(null)} className="rounded-md border border-border px-4 py-2">{L("Cancel", "إلغاء")}</button></div>
    </form>
  );

  const low = (q.data ?? []).filter((p) => p.status === "published" && p.stock <= p.low_stock_at);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{L(`${q.data?.length ?? 0} products`, `${q.data?.length ?? 0} منتج`)}{low.length > 0 && <span className="ms-3 text-destructive">{L(`${low.length} low on stock`, `${low.length} منخفض المخزون`)}</span>}</p>
        <button onClick={() => setEdit({ ...EMPTY_PROD })} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Plus aria-hidden className="h-4 w-4" />{L("Add product", "إضافة منتج")}</button>
      </div>
      {q.isLoading ? <p className="text-muted-foreground">…</p> : !q.data?.length ? <p className={`${card} text-muted-foreground`}>{L("No products yet. Add your first one — it stays a draft until you publish it.", "لا منتجات بعد. أضف أول منتج، ويبقى مسودة حتى تنشره.")}</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start"><tr>{[L("Product", "المنتج"), L("Price", "السعر"), L("Stock", "المخزون"), L("Status", "الحالة"), ""].map((h, i) => <th key={i} className="p-3 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{q.data.map((p) => {
              const sv = stockEdits[p.id!] ?? p.stock;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3"><span className="me-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: p.swatch }} />{ar ? p.name_ar : p.name}<span className="block text-xs text-muted-foreground">{ar ? TYPE_AR[p.type] : p.type}</span></td>
                  <td className="p-3">{fmt(Number(p.price))}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input aria-label={L("Stock", "المخزون")} type="number" min={0} value={sv} onChange={(e) => setStockEdits({ ...stockEdits, [p.id!]: Math.max(0, Math.floor(Number(e.target.value))) })} className="w-20 rounded-md border border-border bg-background p-1" />
                      {sv !== p.stock && <button onClick={() => { void patch(p.id!, { stock: sv }, L("Stock updated", "تم تحديث المخزون")); setStockEdits((s) => { const c = { ...s }; delete c[p.id!]; return c; }); }} className="text-xs text-primary underline">{L("Save", "حفظ")}</button>}
                    </div>
                    {p.stock === 0 ? <span className="text-xs text-destructive">{L("Sold out", "نفدت")}</span> : p.stock <= p.low_stock_at && <span className="text-xs text-destructive">{L("Low", "منخفض")}</span>}
                  </td>
                  <td className="p-3">{L(st(p.status)[0], st(p.status)[1])}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-3">
                    <button onClick={() => setEdit(p)} className="text-primary underline">{L("Edit", "تعديل")}</button>
                    {p.status !== "published" ? <button onClick={() => patch(p.id!, { status: "published" }, L("Published", "تم النشر"))}>{L("Publish", "نشر")}</button> : <button onClick={() => patch(p.id!, { status: "archived" }, L("Hidden from shop", "أُخفي من المتجر"))}>{L("Hide", "إخفاء")}</button>}
                    <button onClick={() => del(p.id!)} className="text-destructive">{L("Delete", "حذف")}</button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Orders({ L, ar }: { L: (e: string, a: string) => string; ar: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("open");
  const q = useQuery({ queryKey: ["supplier-lines"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await sb.from("supplier_order_lines").select("*").eq("supplier_id", u.user!.id).order("created_at", { ascending: false }).limit(500);
    if (error) throw error; return data as Line[];
  } });
  const [track, setTrack] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setTrack(Object.fromEntries(q.data.map((l) => [l.id, l.tracking]))); }, [q.data]);
  const update = async (l: Line, status: string) => {
    if (status === "cancelled" && !confirm(L("Cancel this line? Stock will be returned and the buyer notified.", "إلغاء هذا البند؟ سيُعاد المخزون ويُبلَّغ المشتري."))) return;
    const { error } = await sb.rpc("supplier_update_line", { _line: l.id, _status: status, _tracking: track[l.id] ?? "" });
    if (error) toast.error(error.message.includes("LINE_CLOSED") ? L("This line is already closed.", "هذا البند مغلق.") : error.message);
    else { toast.success(L("Order updated", "تم تحديث الطلب")); qc.invalidateQueries({ queryKey: ["supplier-lines"] }); }
  };
  const lines = (q.data ?? []).filter((l) => filter === "all" || (filter === "open" ? !["delivered", "cancelled"].includes(l.status) : l.status === filter));
  const revenue = (q.data ?? []).filter((l) => l.status !== "cancelled").reduce((s, l) => s + Number(l.amount), 0);
  const next: Record<string, string> = { new: "preparing", preparing: "shipped", shipped: "delivered" };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={L("Open orders", "طلبات مفتوحة")} value={String((q.data ?? []).filter((l) => !["delivered", "cancelled"].includes(l.status)).length)} />
        <Stat label={L("To ship", "بانتظار الشحن")} value={String((q.data ?? []).filter((l) => l.status === "new" || l.status === "preparing").length)} />
        <Stat label={L("Sales (excl. VAT)", "المبيعات (قبل الضريبة)")} value={fmt(revenue)} />
      </div>
      <label className="flex items-center gap-2 text-sm">{L("Show", "عرض")}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-border bg-background p-1.5">
          <option value="open">{L("Open", "المفتوحة")}</option><option value="all">{L("All", "الكل")}</option>
          {Object.keys(next).concat("delivered", "cancelled").map((s) => <option key={s} value={s}>{L(st(s)[0], st(s)[1])}</option>)}
        </select></label>
      {q.isLoading ? <p className="text-muted-foreground">…</p> : !lines.length ? <p className={`${card} text-muted-foreground`}>{L("No orders here yet.", "لا طلبات هنا بعد.")}</p> : (
        <ul className="space-y-3">{lines.map((l) => (
          <li key={l.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium">{l.qty} × {ar ? l.title_ar : l.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString(ar ? "ar-SA" : "en-GB")} · {fmt(Number(l.amount))}</p></div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{L(st(l.status)[0], st(l.status)[1])}</span>
            </div>
            <p className="mt-2 text-sm">{L("Ship to", "الشحن إلى")}: {l.buyer_name}{l.ship_to && ` — ${[l.ship_to.line, l.ship_to.city, l.ship_to.postal, l.ship_to.country].filter(Boolean).join("، ")}`}</p>
            {!["delivered", "cancelled"].includes(l.status) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input aria-label={L("Tracking number", "رقم التتبع")} placeholder={L("Tracking number", "رقم التتبع")} dir="ltr" maxLength={120} value={track[l.id] ?? ""} onChange={(e) => setTrack({ ...track, [l.id]: e.target.value })} className="rounded-md border border-border bg-background p-1.5 text-sm" />
                <button onClick={() => update(l, next[l.status] ?? "delivered")} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">{L(`Mark ${st(next[l.status])[0].toLowerCase()}`, `تحويل إلى: ${st(next[l.status])[1]}`)}</button>
                {track[l.id] !== l.tracking && <button onClick={() => update(l, l.status)} className="text-sm underline">{L("Save tracking", "حفظ رقم التتبع")}</button>}
                <button onClick={() => update(l, "cancelled")} className="text-sm text-destructive">{L("Cancel", "إلغاء")}</button>
              </div>
            )}
            {l.tracking && ["delivered", "cancelled"].includes(l.status) && <p className="mt-2 text-xs text-muted-foreground" dir="ltr">{l.tracking}</p>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>;
}
