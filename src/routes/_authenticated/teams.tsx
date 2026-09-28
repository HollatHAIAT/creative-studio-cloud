import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Users, Workflow } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [
    { title: "Teams & galleries — Arwiqa أروقة" },
    { name: "description", content: "Create team and gallery accounts, manage members and roles, share artworks and run custom review workflows." },
    { property: "og:title", content: "Teams & galleries — Arwiqa" },
    { property: "og:description", content: "Shared artwork management and custom review workflows for teams and galleries." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: TeamsPage,
});

type Org = { id: string; kind: string; name: string; name_ar: string; city: string };
type Member = { id: string; org_id: string; user_id: string | null; email: string; role: string; status: string };
type Step = { name: string; nameAr: string; role: string; allowSelf?: boolean };
type Wf = { id: string; org_id: string; name: string; steps: Step[]; is_default: boolean };
type Draft = { id: string; user_id: string; title: string; title_ar: string; status: string; org_id: string | null; workflow_id: string | null; workflow_step: number };

const ROLES: Record<string, [string, string, string]> = {
  owner: ["Owner", "المالك", "Everything, including deleting the account"],
  manager: ["Manager", "مدير", "Members, roles, workflows and all artworks"],
  editor: ["Editor", "محرر", "Share and edit artworks"],
  reviewer: ["Reviewer", "مراجع", "Approve workflow steps"],
  viewer: ["Viewer", "مشاهد", "View only"],
};
const RANK: Record<string, number> = { owner: 5, manager: 4, editor: 3, reviewer: 2, viewer: 1 };
const box = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

function TeamsPage() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [uid, setUid] = useState<string | null>(null); const [myEmail, setMyEmail] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState(""); const [nameAr, setNameAr] = useState(""); const [kind, setKind] = useState("team"); const [city, setCity] = useState("");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser(); setUid(u.user?.id ?? null); setMyEmail((u.user?.email ?? "").toLowerCase());
    const [o, m] = await Promise.all([sb.from("organizations").select("*").order("created_at"), sb.from("organization_members").select("*")]);
    setOrgs(o.data ?? []); setMembers(m.data ?? []);
    if (!sel && o.data?.length) setSel(o.data[0].id);
  };
  useEffect(() => { void load(); }, []);

  const invites = members.filter((m) => m.status === "invited" && m.email.toLowerCase() === myEmail);
  const myRole = (org: string) => members.find((m) => m.org_id === org && m.user_id === uid && m.status === "active")?.role ?? null;

  async function create() {
    if (name.trim().length < 2) { toast.error(L("Enter a name", "أدخل اسمًا")); return; }
    const { data, error } = await sb.from("organizations").insert({ name: name.trim(), name_ar: nameAr.trim(), kind, city: city.trim() }).select("id").single();
    if (error) { toast.error(L("Couldn't create it.", "تعذّر الإنشاء.")); return; }
    setName(""); setNameAr(""); setCity(""); setSel(data.id); toast.success(L("Created — you're the owner.", "أُنشئ — أنت المالك.")); void load();
  }
  async function accept(id: string) {
    const { error } = await sb.rpc("accept_org_invite", { _invite: id });
    if (error) { toast.error(L("Couldn't accept.", "تعذّر القبول.")); return; }
    toast.success(L("You joined.", "انضممت.")); void load();
  }

  const org = orgs.find((o) => o.id === sel && myRole(o.id));
  return (
    <SiteShell>
      <PageTitle eyebrow={L("Accounts", "الحسابات")} title={L("Teams & galleries", "الفرق والمعارض")}
        sub={L("Work on artworks together: invite members with roles, share listing drafts and set your own review steps.", "اعملوا معًا على الأعمال: ادعُ أعضاء بأدوار، وشارك مسودات الإعلانات، وحدّد خطوات المراجعة الخاصة بك.")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-16 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-6">
          {invites.length > 0 && (
            <section aria-labelledby="inv-h" className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <h2 id="inv-h" className="font-medium">{L("Invitations", "الدعوات")}</h2>
              <ul className="mt-2 space-y-2">{invites.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{L("Join as", "انضم بصفة")} {L(ROLES[m.role]![0], ROLES[m.role]![1])}</span>
                  <button type="button" onClick={() => accept(m.id)} className="rounded-full bg-primary px-3 py-1 text-primary-foreground">{L("Accept", "اقبل")}</button>
                </li>))}</ul>
            </section>)}
          <nav aria-label={L("Your teams", "فرقك")} className="space-y-1">
            {orgs.filter((o) => myRole(o.id)).map((o) => (
              <button key={o.id} type="button" onClick={() => setSel(o.id)} aria-current={sel === o.id}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start ${sel === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                {o.kind === "gallery" ? <Building2 aria-hidden className="h-4 w-4" /> : <Users aria-hidden className="h-4 w-4" />}
                <span className="flex-1 truncate">{(ar && o.name_ar) || o.name}</span>
                <span className="text-xs text-muted-foreground">{L(ROLES[myRole(o.id)!]![0], ROLES[myRole(o.id)!]![1])}</span>
              </button>))}
          </nav>
          <section aria-labelledby="new-h" className="space-y-2 rounded-2xl border border-border p-4">
            <h2 id="new-h" className="font-medium">{L("New team or gallery", "فريق أو معرض جديد")}</h2>
            <div className="flex gap-2">{(["team", "gallery"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-full border px-3 py-1 text-sm ${kind === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{k === "team" ? L("Team", "فريق") : L("Gallery", "معرض")}</button>))}</div>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={L("Name (English)", "الاسم (إنجليزي)")} placeholder={L("Name (English)", "الاسم (إنجليزي)")} className={`${box} w-full`} />
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={80} dir="rtl" lang="ar" aria-label={L("Name (Arabic)", "الاسم (عربي)")} placeholder="الاسم بالعربية" className={`${box} w-full`} />
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} aria-label={L("City", "المدينة")} placeholder={L("City", "المدينة")} className={`${box} w-full`} />
            <button type="button" onClick={create} className="w-full rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Create", "أنشئ")}</button>
          </section>
        </aside>
        <main>
          {!org ? <p className="rounded-2xl border border-border p-6 text-muted-foreground">{L("Create a team or gallery, or accept an invitation, to get started.", "أنشئ فريقًا أو معرضًا، أو اقبل دعوة، للبدء.")}</p>
            : <OrgPanel key={org.id} org={org} role={myRole(org.id)!} uid={uid!} members={members.filter((m) => m.org_id === org.id)} reload={load} L={L} ar={ar} />}
        </main>
      </div>
    </SiteShell>
  );
}

function OrgPanel({ org, role, uid, members, reload, L, ar }: { org: Org; role: string; uid: string; members: Member[]; reload: () => Promise<void>; L: (e: string, a: string) => string; ar: boolean }) {
  const manage = RANK[role]! >= 4; const edit = RANK[role]! >= 3;
  const [wfs, setWfs] = useState<Wf[]>([]); const [shared, setShared] = useState<Draft[]>([]); const [mine, setMine] = useState<Draft[]>([]);
  const [email, setEmail] = useState(""); const [newRole, setNewRole] = useState("editor");
  const [wfName, setWfName] = useState(""); const [steps, setSteps] = useState<Step[]>([{ name: "Curator check", nameAr: "مراجعة القيّم", role: "reviewer" }]);
  const [shareDraft, setShareDraft] = useState(""); const [shareWf, setShareWf] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const [w, s, m] = await Promise.all([
      sb.from("org_review_workflows").select("*").eq("org_id", org.id).order("created_at"),
      sb.from("listing_drafts").select("id,user_id,title,title_ar,status,org_id,workflow_id,workflow_step").eq("org_id", org.id).order("updated_at", { ascending: false }),
      sb.from("listing_drafts").select("id,user_id,title,title_ar,status,org_id,workflow_id,workflow_step").eq("user_id", uid).is("org_id", null).limit(50),
    ]);
    setWfs(w.data ?? []); setShared(s.data ?? []); setMine(m.data ?? []);
    const def = (w.data ?? []).find((x: Wf) => x.is_default); if (def && !shareWf) setShareWf(def.id);
  };
  useEffect(() => { void load(); }, [org.id]);

  async function invite() {
    if (!email.includes("@")) { toast.error(L("Enter an email", "أدخل بريدًا")); return; }
    const { error } = await sb.from("organization_members").insert({ org_id: org.id, email: email.trim().toLowerCase(), role: newRole });
    if (error) { toast.error(L("Couldn't invite (already a member?)", "تعذّرت الدعوة (عضو مسبقًا؟)")); return; }
    setEmail(""); toast.success(L("Invited — they'll see it on this page after signing in with that email.", "أُرسلت الدعوة — سيجدها بعد الدخول بهذا البريد في هذه الصفحة.")); void reload();
  }
  async function setMemberRole(id: string, r: string) { const { error } = await sb.from("organization_members").update({ role: r }).eq("id", id); if (error) toast.error(L("Couldn't change the role.", "تعذّر تغيير الدور.")); void reload(); }
  async function remove(id: string) { const { error } = await sb.from("organization_members").delete().eq("id", id); if (error) toast.error(L("Couldn't remove.", "تعذّرت الإزالة.")); void reload(); }

  async function saveWf() {
    const clean = steps.filter((s) => s.name.trim());
    if (wfName.trim().length < 2 || !clean.length) { toast.error(L("Name the workflow and add at least one step.", "سمِّ المسار وأضف خطوة واحدة على الأقل.")); return; }
    const { error } = await sb.from("org_review_workflows").insert({ org_id: org.id, name: wfName.trim(), steps: clean, is_default: wfs.length === 0 });
    if (error) { toast.error(L("Couldn't save the workflow.", "تعذّر حفظ المسار.")); return; }
    setWfName(""); setSteps([{ name: "", nameAr: "", role: "reviewer" }]); void load();
  }
  async function makeDefault(id: string) {
    await sb.from("org_review_workflows").update({ is_default: false }).eq("org_id", org.id);
    await sb.from("org_review_workflows").update({ is_default: true }).eq("id", id); void load();
  }
  async function delWf(id: string) { await sb.from("org_review_workflows").delete().eq("id", id); void load(); }

  async function share(draft: string, orgId: string | null, wf: string | null) {
    const { error } = await sb.rpc("share_draft_with_org", { _draft: draft, _org: orgId, _workflow: wf });
    if (error) { toast.error(L("Couldn't update sharing.", "تعذّر تحديث المشاركة.")); return; }
    setShareDraft(""); toast.success(orgId ? L("Shared with the team.", "شوركت مع الفريق.") : L("No longer shared.", "أُلغيت المشاركة.")); void load();
  }
  async function decide(d: Draft, approve: boolean) {
    const { error } = await sb.rpc("decide_workflow_step", { _draft: d.id, _approve: approve, _note: notes[d.id] ?? "" });
    if (error) {
      const m = String(error.message);
      toast.error(m.includes("NO_SELF") ? L("You can't approve your own artwork at this step.", "لا يمكنك الموافقة على عملك في هذه الخطوة.")
        : m.includes("NOT_ALLOWED") ? L("Your role can't decide this step.", "دورك لا يسمح بقرار هذه الخطوة.")
        : m.includes("NOTE") ? L("Add a note saying what to change.", "أضف ملاحظة بما يجب تغييره.") : L("Couldn't record the decision.", "تعذّر تسجيل القرار."));
      return;
    }
    setNotes({ ...notes, [d.id]: "" }); toast.success(approve ? L("Step approved", "تمت الموافقة على الخطوة") : L("Changes requested — back to step 1", "طُلبت تعديلات — العودة للخطوة 1")); void load();
  }

  const sec = "space-y-3 rounded-2xl border border-border p-4";
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">{org.kind === "gallery" ? L("Gallery", "معرض") : L("Team", "فريق")}{org.city ? ` · ${org.city}` : ""}</p>
        <h2 className="font-display text-3xl">{(ar && org.name_ar) || org.name}</h2>
        <p className="text-sm text-muted-foreground">{L("Your role:", "دورك:")} {L(ROLES[role]![0], ROLES[role]![1])} — {ROLES[role]![2]}</p>
      </header>

      <section aria-labelledby="mem-h" className={sec}>
        <h3 id="mem-h" className="flex items-center gap-2 font-medium"><Users aria-hidden className="h-4 w-4" />{L("Members & roles", "الأعضاء والأدوار")}</h3>
        <ul className="divide-y divide-border">{members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>{m.email}{m.status === "invited" && <span className="ms-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{L("Invited", "مدعو")}</span>}</span>
            <span className="flex items-center gap-2">
              {manage && m.role !== "owner" ? (
                <select value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value)} aria-label={L(`Role for ${m.email}`, `دور ${m.email}`)} className={box}>
                  {Object.keys(ROLES).filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{L(ROLES[r]![0], ROLES[r]![1])}</option>)}
                </select>) : <span className="text-muted-foreground">{L(ROLES[m.role]![0], ROLES[m.role]![1])}</span>}
              {m.role !== "owner" && (manage || m.user_id === uid) && (
                <button type="button" onClick={() => remove(m.id)} aria-label={m.user_id === uid ? L("Leave", "غادر") : L(`Remove ${m.email}`, `أزل ${m.email}`)} className="rounded-full p-1.5 text-muted-foreground hover:text-destructive"><Trash2 aria-hidden className="h-4 w-4" /></button>)}
            </span>
          </li>))}</ul>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} aria-label={L("Email to invite", "البريد للدعوة")} placeholder="name@example.com" className={`${box} flex-1`} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label={L("Role", "الدور")} className={box}>
              {Object.keys(ROLES).filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{L(ROLES[r]![0], ROLES[r]![1])}</option>)}
            </select>
            <button type="button" onClick={invite} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{L("Invite", "ادعُ")}</button>
          </div>)}
      </section>

      <section aria-labelledby="wf-h" className={sec}>
        <h3 id="wf-h" className="flex items-center gap-2 font-medium"><Workflow aria-hidden className="h-4 w-4" />{L("Review workflows", "مسارات المراجعة")}</h3>
        {wfs.length === 0 && <p className="text-sm text-muted-foreground">{L("No workflows yet. Shared artworks can still be edited together.", "لا مسارات بعد. يمكن تحرير الأعمال المشتركة معًا.")}</p>}
        <ul className="space-y-2">{wfs.map((w) => (
          <li key={w.id} className="rounded-xl bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{w.name}{w.is_default && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{L("Default", "افتراضي")}</span>}</span>
              {manage && <span className="flex gap-2 text-xs">{!w.is_default && <button type="button" onClick={() => makeDefault(w.id)} className="underline">{L("Make default", "اجعله افتراضيًا")}</button>}<button type="button" onClick={() => delWf(w.id)} className="text-destructive underline">{L("Delete", "احذف")}</button></span>}
            </div>
            <ol className="mt-2 flex flex-wrap gap-2">{w.steps.map((s, i) => (
              <li key={i} className="rounded-full border border-border px-3 py-1 text-xs">{i + 1}. {(ar && s.nameAr) || s.name} · {L(ROLES[s.role]?.[0] ?? s.role, ROLES[s.role]?.[1] ?? s.role)}</li>))}</ol>
          </li>))}</ul>
        {manage && (
          <div className="space-y-2 border-t border-border pt-3">
            <input value={wfName} onChange={(e) => setWfName(e.target.value)} maxLength={80} aria-label={L("Workflow name", "اسم المسار")} placeholder={L("Workflow name, e.g. Gallery standard", "اسم المسار، مثل: معيار المعرض")} className={`${box} w-full`} />
            {steps.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[2rem_1fr_1fr_9rem_auto_auto] sm:items-center">
                <span className="text-sm text-muted-foreground">{i + 1}.</span>
                <input value={s.name} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label={L(`Step ${i + 1} name`, `اسم الخطوة ${i + 1}`)} placeholder={L("Step name", "اسم الخطوة")} className={box} />
                <input value={s.nameAr} dir="rtl" lang="ar" onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, nameAr: e.target.value } : x))} aria-label={L(`Step ${i + 1} Arabic name`, `الاسم العربي للخطوة ${i + 1}`)} placeholder="بالعربية" className={box} />
                <select value={s.role} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} aria-label={L("Who approves", "من يوافق")} className={box}>
                  {["reviewer", "editor", "manager", "owner"].map((r) => <option key={r} value={r}>{L(ROLES[r]![0], ROLES[r]![1])}+</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!s.allowSelf} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, allowSelf: e.target.checked } : x))} />{L("Self-approve OK", "موافقة ذاتية")}</label>
                {steps.length > 1 && <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={L("Remove step", "احذف الخطوة")} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 aria-hidden className="h-4 w-4" /></button>}
              </div>))}
            <div className="flex flex-wrap gap-2">
              {steps.length < 8 && <button type="button" onClick={() => setSteps([...steps, { name: "", nameAr: "", role: "reviewer" }])} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"><Plus aria-hidden className="h-3.5 w-3.5" />{L("Add step", "أضف خطوة")}</button>}
              <button type="button" onClick={saveWf} className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">{L("Save workflow", "احفظ المسار")}</button>
            </div>
          </div>)}
      </section>

      <section aria-labelledby="art-h" className={sec}>
        <h3 id="art-h" className="font-medium">{L("Shared artworks", "الأعمال المشتركة")}</h3>
        {edit && mine.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <select value={shareDraft} onChange={(e) => setShareDraft(e.target.value)} aria-label={L("Your draft to share", "مسودتك للمشاركة")} className={`${box} flex-1`}>
              <option value="">{L("Share one of your drafts…", "شارك إحدى مسوداتك…")}</option>
              {mine.map((d) => <option key={d.id} value={d.id}>{(ar ? d.title_ar : d.title) || L("Untitled", "بدون عنوان")}</option>)}
            </select>
            <select value={shareWf} onChange={(e) => setShareWf(e.target.value)} aria-label={L("Workflow", "المسار")} className={box}>
              <option value="">{L("No workflow", "بلا مسار")}</option>
              {wfs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button type="button" disabled={!shareDraft} onClick={() => share(shareDraft, org.id, shareWf || null)} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{L("Share", "شارك")}</button>
          </div>)}
        {shared.length === 0 ? <p className="text-sm text-muted-foreground">{L("No shared artworks yet.", "لا أعمال مشتركة بعد.")}</p> : (
          <ul className="space-y-3">{shared.map((d) => {
            const w = wfs.find((x) => x.id === d.workflow_id); const n = w?.steps.length ?? 0; const done = !!w && d.workflow_step >= n;
            const cur = w && !done ? w.steps[d.workflow_step] : null;
            const canDecide = !!cur && (RANK[role]! >= 4 || RANK[role]! >= (RANK[cur.role] ?? 2));
            return (
              <li key={d.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{(ar ? d.title_ar : d.title) || L("Untitled", "بدون عنوان")}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {edit && <a href={`/listing-writer?draft=${d.id}`} className="underline">{L("Open", "افتح")}</a>}
                    {d.user_id === uid && <button type="button" onClick={() => share(d.id, null, null)} className="underline">{L("Stop sharing", "أوقف المشاركة")}</button>}
                  </span>
                </div>
                {w ? (<>
                  <ol aria-label={L("Workflow progress", "تقدّم المسار")} className="mt-2 flex flex-wrap gap-1">{w.steps.map((s, i) => (
                    <li key={i} className={`rounded-full px-2 py-0.5 text-xs ${i < d.workflow_step ? "bg-success/15 text-success" : i === d.workflow_step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {i < d.workflow_step ? "✓ " : ""}{(ar && s.nameAr) || s.name}<span className="sr-only">{i < d.workflow_step ? L(" (done)", " (منجزة)") : i === d.workflow_step ? L(" (current)", " (الحالية)") : ""}</span></li>))}</ol>
                  {done ? <p className="mt-2 text-success">{L("All steps approved — ready to publish from the listing writer.", "اكتملت كل الخطوات — جاهز للنشر من كاتب الإعلانات.")}</p>
                    : canDecide && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input value={notes[d.id] ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} maxLength={1000} aria-label={L("Note", "ملاحظة")} placeholder={L("Note (required to request changes)", "ملاحظة (مطلوبة لطلب التعديلات)")} className={`${box} flex-1`} />
                        <button type="button" onClick={() => decide(d, true)} className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">{L("Approve step", "وافق على الخطوة")}</button>
                        <button type="button" onClick={() => decide(d, false)} className="rounded-full border border-border px-3 py-1.5">{L("Request changes", "اطلب تعديلات")}</button>
                      </div>)}
                </>) : <p className="mt-1 text-xs text-muted-foreground">{L("No workflow — shared for editing only.", "بلا مسار — مشتركة للتحرير فقط.")}</p>}
              </li>); })}</ul>)}
      </section>
    </div>
  );
}
