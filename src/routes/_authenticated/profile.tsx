import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { User, MapPin, KeyRound, Trash2, Landmark, Plus, Star, Upload } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "My profile — Arwiqa أروقة" }, { name: "description", content: "Manage your details, shipping addresses, password, seller bio and payout account." },
    { property: "og:title", content: "My profile — Arwiqa أروقة" }, { property: "og:description", content: "Your Arwiqa account and profile." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Profile,
});

type Prof = { display_name: string; phone: string; avatar_url: string; bio: string; bio_ar: string; city: string };
type Addr = { id?: string; label: string; full_name: string; phone: string; line1: string; line2: string; city: string; region: string; postal_code: string; country: string; is_default: boolean };
type Payout = { account_holder: string; bank_name: string; iban: string; swift: string };
const EMPTY_P: Prof = { display_name: "", phone: "", avatar_url: "", bio: "", bio_ar: "", city: "" };
const EMPTY_A: Addr = { label: "", full_name: "", phone: "", line1: "", line2: "", city: "", region: "", postal_code: "", country: "Saudi Arabia", is_default: false };
const input = "mt-1 w-full rounded-md border border-border bg-background p-2";
const card = "rounded-md border border-border bg-card p-6";

function useUser() {
  return useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });
}

function Profile() {
  const { locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [tab, setTab] = useState<"details" | "addresses" | "security" | "seller">("details");
  const tabs = [
    { k: "details", en: "My details", ar: "بياناتي", icon: User }, { k: "addresses", en: "Shipping addresses", ar: "عناوين الشحن", icon: MapPin },
    { k: "seller", en: "Seller profile & payouts", ar: "ملف البائع والاستلام", icon: Landmark }, { k: "security", en: "Password & account", ar: "كلمة المرور والحساب", icon: KeyRound },
  ] as const;
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Account", "الحساب")} title={L("My profile", "ملفي الشخصي")} sub={L("Your details, addresses, password and seller settings.", "بياناتك وعناوينك وكلمة المرور وإعدادات البائع.")} />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-20 md:grid-cols-[220px_1fr]">
        <nav aria-label={L("Profile sections", "أقسام الملف")} className="flex gap-1 overflow-x-auto md:flex-col">
          {tabs.map((t) => <button key={t.k} onClick={() => setTab(t.k)} aria-current={tab === t.k}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-start text-sm ${tab === t.k ? "bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}><t.icon aria-hidden className="h-4 w-4" />{L(t.en, t.ar)}</button>)}
        </nav>
        <div>{tab === "details" ? <Details L={L} /> : tab === "addresses" ? <Addresses L={L} /> : tab === "seller" ? <Seller L={L} /> : <Security L={L} />}</div>
      </div>
    </SiteShell>
  );
}

function useProfile() {
  const me = useUser();
  const q = useQuery({ queryKey: ["profile", me.data?.id], enabled: !!me.data, queryFn: async () => {
    const { data } = await supabase.from("profiles" as never).select("display_name,phone,avatar_url,bio,bio_ar,city").eq("user_id", me.data!.id).maybeSingle();
    return { ...EMPTY_P, ...((data as Partial<Prof> | null) ?? {}) };
  } });
  const qc = useQueryClient();
  const save = async (p: Partial<Prof>) => {
    const { error } = await supabase.from("profiles" as never).upsert({ user_id: me.data!.id, ...q.data, ...p } as never);
    if (error) { toast.error(error.message); return false; }
    await qc.invalidateQueries({ queryKey: ["profile"] }); return true;
  };
  return { me: me.data, profile: q.data, loading: q.isLoading || me.isLoading, save };
}

function Avatar({ path, size = 80 }: { path: string; size?: number }) {
  const q = useQuery({ queryKey: ["avatar", path], enabled: !!path, queryFn: async () => (await supabase.storage.from("avatars").createSignedUrl(path, 3600)).data?.signedUrl ?? "" });
  return q.data ? <img src={q.data} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="grid place-items-center rounded-full bg-muted" style={{ width: size, height: size }}><User aria-hidden className="h-1/2 w-1/2 text-muted-foreground" /></span>;
}

function Details({ L }: { L: (e: string, a: string) => string }) {
  const { me, profile, loading, save } = useProfile();
  const [f, setF] = useState<Prof>(EMPTY_P);
  useEffect(() => { if (profile) setF(profile); }, [profile]);
  if (loading) return <p className="text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</p>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await save({ display_name: f.display_name.trim(), phone: f.phone.trim(), city: f.city.trim() })) toast.success(L("Saved", "تم الحفظ")); }} className={card}>
      <h2 className="font-display text-2xl">{L("My details", "بياناتي")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{L("Email", "البريد")}: {me?.email}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">{L("Display name", "الاسم الظاهر")}<input value={f.display_name} maxLength={80} onChange={(e) => setF({ ...f, display_name: e.target.value })} className={input} /></label>
        <label className="text-sm">{L("Mobile", "الجوال")}<input type="tel" dir="ltr" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+966 5x xxx xxxx" className={input} /></label>
        <label className="text-sm">{L("City", "المدينة")}<input value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} className={input} /></label>
      </div>
      <button className="mt-6 rounded-md bg-primary px-5 py-2 text-primary-foreground">{L("Save details", "حفظ البيانات")}</button>
    </form>
  );
}

function Addresses({ L }: { L: (e: string, a: string) => string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["addresses"], queryFn: async () => {
    const { data, error } = await supabase.from("shipping_addresses" as never).select("*").order("is_default", { ascending: false }).order("created_at");
    if (error) throw error; return (data ?? []) as unknown as Addr[];
  } });
  const [edit, setEdit] = useState<Addr | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const submit = async () => {
    if (!edit) return;
    if (!edit.full_name.trim() || !edit.line1.trim() || !edit.city.trim()) { toast.error(L("Name, address and city are required.", "الاسم والعنوان والمدينة مطلوبة.")); return; }
    const row = Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const { error } = edit.id ? await supabase.from("shipping_addresses" as never).update(row as never).eq("id", edit.id) : await supabase.from("shipping_addresses" as never).insert(row as never);
    if (error) { toast.error(error.message); return; }
    toast.success(L("Address saved", "تم حفظ العنوان")); setEdit(null); refresh();
  };
  const del = async (id: string) => {
    if (!confirm(L("Delete this address?", "حذف هذا العنوان؟"))) return;
    const { error } = await supabase.from("shipping_addresses" as never).delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const makeDefault = async (id: string) => { const { error } = await supabase.from("shipping_addresses" as never).update({ is_default: true } as never).eq("id", id); if (error) toast.error(error.message); else refresh(); };
  const fld = (k: keyof Addr, en: string, ar: string, extra: Record<string, unknown> = {}) => (
    <label className="text-sm">{L(en, ar)}<input value={String(edit![k] ?? "")} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} className={input} {...extra} /></label>
  );
  return (
    <div className={card}>
      <div className="flex items-center justify-between"><h2 className="font-display text-2xl">{L("Shipping addresses", "عناوين الشحن")}</h2>
        {!edit && <button onClick={() => setEdit({ ...EMPTY_A, is_default: !(q.data?.length) })} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Plus aria-hidden className="h-4 w-4" />{L("Add address", "إضافة عنوان")}</button>}</div>
      {edit ? (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-4 grid gap-3 md:grid-cols-2">
          {fld("label", "Label (e.g. Home)", "التسمية (مثل: المنزل)", { maxLength: 40 })}
          {fld("full_name", "Recipient name", "اسم المستلم", { maxLength: 120, required: true })}
          {fld("phone", "Phone", "الجوال", { maxLength: 30, dir: "ltr", type: "tel" })}
          {fld("country", "Country", "الدولة", { maxLength: 60 })}
          {fld("line1", "Address (street, building)", "العنوان (الشارع، المبنى)", { maxLength: 200, required: true })}
          {fld("line2", "District / details", "الحي / تفاصيل إضافية", { maxLength: 200 })}
          {fld("city", "City", "المدينة", { maxLength: 80, required: true })}
          {fld("region", "Region", "المنطقة", { maxLength: 80 })}
          {fld("postal_code", "Postal code", "الرمز البريدي", { maxLength: 20, dir: "ltr" })}
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} />{L("Default address", "العنوان الافتراضي")}</label>
          <div className="flex gap-3 md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{L("Save", "حفظ")}</button><button type="button" onClick={() => setEdit(null)} className="rounded-md border border-border px-4 py-2">{L("Cancel", "إلغاء")}</button></div>
        </form>
      ) : q.isLoading ? <p className="mt-4 text-muted-foreground">…</p> : !q.data?.length ? <p className="mt-4 text-muted-foreground">{L("No saved addresses yet.", "لا توجد عناوين محفوظة بعد.")}</p> : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {q.data.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-4 text-sm">
              <p className="font-medium">{a.label || L("Address", "عنوان")}{a.is_default && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L("Default", "افتراضي")}</span>}</p>
              <p className="mt-1">{a.full_name}{a.phone && ` · ${a.phone}`}</p>
              <p className="text-muted-foreground">{[a.line1, a.line2, a.city, a.region, a.postal_code, a.country].filter(Boolean).join("، ")}</p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => setEdit(a)} className="text-primary underline">{L("Edit", "تعديل")}</button>
                {!a.is_default && <button onClick={() => makeDefault(a.id!)} className="inline-flex items-center gap-1"><Star aria-hidden className="h-3.5 w-3.5" />{L("Make default", "اجعله افتراضيًا")}</button>}
                <button onClick={() => del(a.id!)} className="text-destructive">{L("Delete", "حذف")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Seller({ L }: { L: (e: string, a: string) => string }) {
  const { me, profile, loading, save } = useProfile();
  const qc = useQueryClient();
  const [bio, setBio] = useState({ bio: "", bio_ar: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile) setBio({ bio: profile.bio, bio_ar: profile.bio_ar }); }, [profile]);
  const pq = useQuery({ queryKey: ["payout"], queryFn: async () => (await supabase.from("seller_payout_accounts" as never).select("account_holder,bank_name,iban,swift").maybeSingle()).data as Payout | null });
  const [pay, setPay] = useState<Payout>({ account_holder: "", bank_name: "", iban: "", swift: "" });
  const [editPay, setEditPay] = useState(false);
  useEffect(() => { if (pq.data) setPay(pq.data); }, [pq.data]);
  if (loading) return <p className="text-muted-foreground">…</p>;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) { toast.error(L("Choose an image under 3 MB.", "اختر صورة أصغر من ٣ ميغابايت.")); return; }
    setBusy(true);
    const path = `${me!.id}/avatar-${Date.now()}.${file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); setBusy(false); return; }
    const old = profile?.avatar_url;
    if (await save({ avatar_url: path })) { if (old) await supabase.storage.from("avatars").remove([old]); toast.success(L("Photo updated", "تم تحديث الصورة")); }
    setBusy(false);
  };
  const savePay = async () => {
    const iban = pay.iban.replace(/\s+/g, "").toUpperCase(), swift = pay.swift.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) { toast.error(L("Enter a valid IBAN, e.g. SA03 8000 0000 6080 1016 7519.", "أدخل رقم آيبان صحيحًا، مثل SA03 8000 0000 6080 1016 7519.")); return; }
    if (iban.startsWith("SA") && iban.length !== 24) { toast.error(L("Saudi IBANs are 24 characters.", "الآيبان السعودي مكوّن من ٢٤ خانة.")); return; }
    if (swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) { toast.error(L("SWIFT code must be 8 or 11 characters.", "رمز السويفت ٨ أو ١١ خانة.")); return; }
    const { error } = await supabase.from("seller_payout_accounts" as never).upsert({ user_id: me!.id, account_holder: pay.account_holder.trim(), bank_name: pay.bank_name.trim(), iban, swift } as never);
    if (error) { toast.error(error.message); return; }
    toast.success(L("Payout account saved", "تم حفظ حساب الاستلام")); setEditPay(false); qc.invalidateQueries({ queryKey: ["payout"] });
  };
  const masked = (s: string) => s.length > 8 ? `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}` : s;

  return (
    <div className="space-y-6">
      <div className={card}>
        <h2 className="font-display text-2xl">{L("Seller profile", "ملف البائع")}</h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar path={profile?.avatar_url ?? ""} />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <Upload aria-hidden className="h-4 w-4" />{busy ? L("Uploading…", "جارٍ الرفع…") : L("Change photo", "تغيير الصورة")}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
        </div>
        <form onSubmit={async (e) => { e.preventDefault(); if (await save({ bio: bio.bio.trim(), bio_ar: bio.bio_ar.trim() })) toast.success(L("Bio saved", "تم حفظ النبذة")); }} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">{L("Bio (English)", "النبذة (إنجليزي)")}<textarea dir="ltr" rows={5} maxLength={1500} value={bio.bio} onChange={(e) => setBio({ ...bio, bio: e.target.value })} className={input} /></label>
          <label className="text-sm">{L("Bio (Arabic)", "النبذة (عربي)")}<textarea dir="rtl" rows={5} maxLength={1500} value={bio.bio_ar} onChange={(e) => setBio({ ...bio, bio_ar: e.target.value })} className={input} /></label>
          <button className="w-fit rounded-md bg-primary px-5 py-2 text-primary-foreground">{L("Save bio", "حفظ النبذة")}</button>
        </form>
      </div>
      <div className={card}>
        <h2 className="font-display text-2xl">{L("Bank payout account", "حساب الاستلام البنكي")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{L("Where your sales are transferred. Only you and platform admins can see these details.", "الحساب الذي تُحوَّل إليه مبيعاتك. لا يراه إلا أنت ومديرو المنصة.")}</p>
        {pq.data && !editPay ? (
          <div className="mt-4 text-sm">
            <p>{pq.data.account_holder} · {pq.data.bank_name}</p>
            <p dir="ltr" className="text-start font-mono">{masked(pq.data.iban)}{pq.data.swift && ` · ${pq.data.swift}`}</p>
            <button onClick={() => setEditPay(true)} className="mt-3 text-primary underline">{L("Change account", "تغيير الحساب")}</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void savePay(); }} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">{L("Account holder name", "اسم صاحب الحساب")}<input required maxLength={120} value={pay.account_holder} onChange={(e) => setPay({ ...pay, account_holder: e.target.value })} className={input} /></label>
            <label className="text-sm">{L("Bank", "البنك")}<input required maxLength={120} value={pay.bank_name} onChange={(e) => setPay({ ...pay, bank_name: e.target.value })} className={input} /></label>
            <label className="text-sm">IBAN<input required dir="ltr" maxLength={42} value={pay.iban} onChange={(e) => setPay({ ...pay, iban: e.target.value })} placeholder="SA00 0000 0000 0000 0000 0000" className={`${input} font-mono`} /></label>
            <label className="text-sm">{L("SWIFT (optional)", "السويفت (اختياري)")}<input dir="ltr" maxLength={11} value={pay.swift} onChange={(e) => setPay({ ...pay, swift: e.target.value })} className={`${input} font-mono`} /></label>
            <div className="flex gap-3 md:col-span-2"><button className="rounded-md bg-primary px-5 py-2 text-primary-foreground">{L("Save account", "حفظ الحساب")}</button>
              {pq.data && <button type="button" onClick={() => { setPay(pq.data!); setEditPay(false); }} className="rounded-md border border-border px-4 py-2">{L("Cancel", "إلغاء")}</button>}</div>
          </form>
        )}
      </div>
    </div>
  );
}

function Security({ L }: { L: (e: string, a: string) => string }) {
  const me = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useServerFn(deleteMyAccount);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const change = async () => {
    if (pw.next.length < 8) { toast.error(L("Use at least 8 characters.", "استخدم ٨ أحرف على الأقل.")); return; }
    if (pw.next !== pw.again) { toast.error(L("The new passwords don't match.", "كلمتا المرور الجديدتان غير متطابقتين.")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPw({ current: "", next: "", again: "" }); toast.success(L("Password changed", "تم تغيير كلمة المرور"));
  };
  const remove = async () => {
    if (!confirm(L("This permanently deletes your account. Continue?", "سيُحذف حسابك نهائيًا. هل تريد المتابعة؟"))) return;
    setBusy(true);
    try {
      const r = await del({ data: { confirmEmail } });
      if (!r.ok) { toast.error(r.error); return; }
      await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut();
      toast.success(L("Your account was deleted.", "تم حذف حسابك.")); navigate({ to: "/", replace: true });
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); void change(); }} className={card}>
        <h2 className="font-display text-2xl">{L("Change password", "تغيير كلمة المرور")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{L("If you signed up with Google, you can set a password here too.", "إن سجّلت عبر Google يمكنك تعيين كلمة مرور هنا أيضًا.")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm">{L("Current password", "كلمة المرور الحالية")}<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={input} /></label>
          <label className="text-sm">{L("New password", "كلمة المرور الجديدة")}<input type="password" autoComplete="new-password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={input} /></label>
          <label className="text-sm">{L("Repeat new password", "أعد كتابة كلمة المرور")}<input type="password" autoComplete="new-password" required value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} className={input} /></label>
        </div>
        <button disabled={busy} className="mt-4 rounded-md bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50">{L("Change password", "تغيير كلمة المرور")}</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); void remove(); }} className="rounded-md border border-destructive/40 bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl text-destructive"><Trash2 aria-hidden className="h-5 w-5" />{L("Delete account", "حذف الحساب")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{L("This removes your profile, addresses, payout details, favorites and saved searches for good. Records needed for completed orders are kept.", "يحذف ملفك وعناوينك وبيانات الاستلام والمفضلة وعمليات البحث المحفوظة نهائيًا. تُحفظ السجلات اللازمة للطلبات المكتملة.")}</p>
        <label className="mt-4 block text-sm">{L(`Type your email (${me.data?.email ?? ""}) to confirm`, `اكتب بريدك (${me.data?.email ?? ""}) للتأكيد`)}
          <input dir="ltr" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className={input} /></label>
        <button disabled={busy || confirmEmail.trim().toLowerCase() !== (me.data?.email ?? "").toLowerCase()} className="mt-4 rounded-md bg-destructive px-5 py-2 text-destructive-foreground disabled:opacity-40">{L("Delete my account", "احذف حسابي")}</button>
      </form>
    </div>
  );
}
