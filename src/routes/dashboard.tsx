import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { categories, creatorOf, fmt, type Category, type Listing, type ListingStatus } from "@/lib/data";
import { actions, DEMO_CREATOR, useAllListings } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — creativestudio" },
      { name: "description", content: "Create, edit and remove your marketplace listings." },
      { property: "og:title", content: "Creator dashboard — creativestudio" },
      { property: "og:description", content: "Manage your listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const MAX_FILES = 5, MAX_MB = 5, TYPES = ["image/jpeg", "image/png", "image/webp"];

type Form = { id?: string; title: string; category: Category; price: string; medium: string; year: string; description: string; formats: string; images: string[]; status: ListingStatus };
const blank: Form = { title: "", category: "Painting", price: "", medium: "", year: String(new Date().getFullYear()), description: "", formats: "Original, Print", images: [], status: "draft" };

function shrink(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * s; c.height = img.height * s;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function Dashboard() {
  const [sel, setSel] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const mine = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const creator = creatorOf(DEMO_CREATOR)!;
  const [confirmDel, setConfirmDel] = useState(false);
  const shown = mine.filter((l) => statusFilter === "all" || l.status === statusFilter);
  function bulk(status: ListingStatus) {
    const n = sel.length;
    const undo = actions.setStatus(sel, status);
    setSel([]);
    toast.success(`${n} listing${n > 1 ? "s" : ""} set to ${status}`, { action: { label: "Undo", onClick: undo }, duration: 8000 });
  }
  function bulkDelete() {
    const n = sel.length;
    const undo = actions.removeMany(sel);
    setSel([]); setConfirmDel(false);
    toast(`${n} listing${n > 1 ? "s" : ""} deleted`, { action: { label: "Undo", onClick: undo }, duration: 10000 });
  }

  async function onFiles(files: FileList | null) {
    if (!files || !form) return;
    const errs: string[] = [];
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (!TYPES.includes(f.type)) errs.push(`${f.name}: only JPG, PNG or WebP`);
      else if (f.size > MAX_MB * 1024 * 1024) errs.push(`${f.name}: larger than ${MAX_MB}MB`);
      else ok.push(f);
    }
    const room = MAX_FILES - form.images.length;
    if (ok.length > room) errs.push(`Up to ${MAX_FILES} images per listing`);
    const urls = await Promise.all(ok.slice(0, room).map(shrink));
    setErrors(errs);
    setForm({ ...form, images: [...form.images, ...urls] });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const errs: string[] = [];
    const price = Number(form.price);
    if (!form.title.trim()) errs.push("Title is required");
    if (!(price > 0)) errs.push("Price must be greater than 0");
    if (form.images.length === 0) errs.push("Add at least one image");
    if (form.description.trim().length < 20) errs.push("Description should be at least 20 characters");
    setErrors(errs);
    if (errs.length) return;
    const existing = mine.find((m) => m.id === form.id);
    const listing: Listing = {
      id: form.id ?? `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`,
      title: form.title.trim(), creatorId: DEMO_CREATOR, category: form.category, images: form.images,
      price, medium: form.medium.trim(), year: Number(form.year) || new Date().getFullYear(),
      description: form.description.trim(), formats: form.formats.split(",").map((s) => s.trim()).filter(Boolean),
      createdAt: existing?.createdAt ?? Date.now(), ...(existing?.auction ? { auction: existing.auction } : {}), status: form.status,
    };
    actions.save(listing);
    toast.success(form.id ? "Listing updated" : "Listing published");
    setForm(null);
  }

  const edit = (l: Listing) => { setErrors([]); setForm({ id: l.id, title: l.title, category: l.category, price: String(l.price), medium: l.medium, year: String(l.year), description: l.description, formats: l.formats.join(", "), images: l.images, status: l.status ?? "published" }); };
  const field = "w-full rounded-sm border border-border bg-background px-3 py-2";

  return (
    <SiteShell>
      <PageTitle eyebrow={`Signed in as ${creator.name} (demo)`} title="Your listings" />
      <div className="mx-auto max-w-7xl px-6">
        {!form && <button onClick={() => { setErrors([]); setForm(blank); }} className="mb-8 rounded-full bg-primary px-6 py-3 text-primary-foreground">New listing</button>}

        {form && (
          <form onSubmit={submit} className="mb-12 grid gap-4 rounded-sm border border-border bg-card p-6 md:grid-cols-2">
            <h2 className="font-display text-3xl md:col-span-2">{form.id ? "Edit listing" : "New listing"}</h2>
            <label className="text-sm">Title<input className={field} value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="text-sm">Category<select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-sm">Price (USD)<input type="number" min="1" className={field} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            <label className="text-sm">Year<input type="number" className={field} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
            <label className="text-sm">Medium<input className={field} value={form.medium} maxLength={100} onChange={(e) => setForm({ ...form, medium: e.target.value })} /></label>
            <label className="text-sm">Visibility<select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ListingStatus })}><option value="draft">Draft — only you</option><option value="published">Published — on marketplace</option><option value="archived">Archived — hidden</option></select></label>
            <label className="text-sm">Formats (comma separated)<input className={field} value={form.formats} onChange={(e) => setForm({ ...form, formats: e.target.value })} /></label>
            <label className="text-sm md:col-span-2">Description<textarea rows={4} maxLength={2000} className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="md:col-span-2">
              <p className="text-sm">Images ({form.images.length}/{MAX_FILES}) — JPG, PNG or WebP, max {MAX_MB}MB each. First image is the cover.</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {form.images.map((src, i) => (
                  <div key={i} className="relative h-24 w-24">
                    <img src={src} alt="" className="h-full w-full rounded-sm object-cover" />
                    <button type="button" aria-label="Remove image" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {form.images.length < MAX_FILES && (
                  <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-sm border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary">
                    + Add
                    <input type="file" accept={TYPES.join(",")} multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>
            {errors.length > 0 && <ul className="text-sm text-destructive md:col-span-2">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
            <div className="flex gap-3 md:col-span-2">
              <button className="rounded-full bg-primary px-6 py-3 text-primary-foreground">{form.id ? "Save changes" : form.status === "published" ? "Publish" : "Save"}</button>
              <button type="button" onClick={() => setForm(null)} className="rounded-full border border-border px-6 py-3">Cancel</button>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shown.length > 0 && sel.length === shown.length} onChange={(e) => setSel(e.target.checked ? shown.map((l) => l.id) : [])} /> Select all</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSel([]); }} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">
            <option value="all">All states</option><option value="draft">Drafts</option><option value="published">Published</option><option value="archived">Archived</option>
          </select>
          {sel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm">
              <span>{sel.length} selected</span>
              <button onClick={() => bulk("published")} className="underline">Publish</button>
              <button onClick={() => bulk("archived")} className="underline">Archive</button>
              <button onClick={() => bulk("draft")} className="underline">Move to draft</button>
              <button onClick={() => setConfirmDel(true)} className="text-destructive underline">Delete</button>
            </div>
          )}
          <Link to="/analytics" className="ml-auto text-sm underline">View analytics</Link>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {shown.map((l) => (
            <div key={l.id} className="flex items-center gap-4 py-4">
              <input type="checkbox" aria-label={`Select ${l.title}`} checked={sel.includes(l.id)} onChange={(e) => setSel(e.target.checked ? [...sel, l.id] : sel.filter((x) => x !== l.id))} />
              <img src={l.image} alt="" className="h-16 w-16 rounded-sm object-cover" />
              <div className="flex-1">
                <Link to="/artwork/$id" params={{ id: l.id }} className="font-display text-xl hover:underline">{l.title}</Link>
                <p className="text-sm text-muted-foreground">{l.category} · {fmt(l.price)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${l.status === "published" ? "bg-primary text-primary-foreground" : l.status === "draft" ? "bg-muted" : "bg-secondary text-secondary-foreground"}`}>{l.status}</span>
              <button onClick={() => edit(l)} className="rounded-full border border-border px-4 py-2 text-sm">Edit</button>
            </div>
          ))}
          {shown.length === 0 && <p className="py-6 text-muted-foreground">No listings here.</p>}
        </div>
        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {sel.length} listing{sel.length > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>They'll be removed from the marketplace and your dashboard. You can undo right after.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SiteShell>
  );
}
