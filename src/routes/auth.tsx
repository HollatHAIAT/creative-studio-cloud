import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteShell } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useLocale } from "@/lib/i18n";
import { safeNext } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s["next"] === "string" ? (s["next"] as string) : undefined }),
  head: () => ({ meta: [
    { title: "Sign in — creativestudio" }, { name: "description", content: "Sign in or create your creativestudio account to bid, book tickets and buy art." },
    { property: "og:title", content: "Sign in — creativestudio" }, { property: "og:description", content: "Your creativestudio account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: AuthPage,
});

const schema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8).max(72) });

function AuthPage() {
  const { t } = useLocale();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = safeNext(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email: p.data.email, password: p.data.password, options: { emailRedirectTo: `${window.location.origin}${dest}`, data: { display_name: name.trim().slice(0, 60) } } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (!data.session) { toast.success(t("auth.checkEmail")); setMode("in"); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
    }
    navigate({ to: dest });
  }

  async function google() {
    if (next) sessionStorage.setItem("cs-next", dest);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error(String(r.error.message ?? r.error)); return; }
    if (r.redirected) return;
    navigate({ to: dest });
  }

  const field = "w-full rounded-sm border border-border bg-background px-3 py-2";
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-6 pt-16">
        <h1 className="font-display text-5xl">{mode === "in" ? t("auth.title") : t("auth.signup")}</h1>
        <button onClick={google} className="mt-8 w-full rounded-full border border-foreground py-3">{t("auth.google")}</button>
        <p className="my-6 text-center text-sm text-muted-foreground">{t("auth.or")}</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && <label className="block text-sm">{t("auth.name")}<input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="block text-sm">{t("auth.email")}<input type="email" required className={field} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></label>
          <label className="block text-sm">{t("auth.password")}<input type="password" required minLength={8} className={field} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label>
          <button disabled={busy} className="w-full rounded-full bg-primary py-3 text-primary-foreground disabled:opacity-50">{mode === "in" ? t("auth.title") : t("auth.signup")}</button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm underline">{mode === "in" ? t("auth.noAccount") : t("auth.haveAccount")}</button>
      </div>
    </SiteShell>
  );
}
