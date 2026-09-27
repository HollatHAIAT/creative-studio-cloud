import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : "" }),
  head: () => ({
    meta: [
      { title: "Unsubscribe — Arwiqa أروقة" },
      { name: "description", content: "Stop saved-search alert emails from Arwiqa." },
      { property: "og:title", content: "Unsubscribe — Arwiqa أروقة" },
      { property: "og:description", content: "Manage your saved-search alert emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const { token } = Route.useSearch();
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [state, setState] = useState<"working" | "done" | "invalid">("working");
  useEffect(() => {
    const ok = /^[0-9a-f-]{36}$/i.test(token);
    if (!ok) { setState("invalid"); return; }
    void (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: boolean | null; error: unknown }>)("unsubscribe_saved_search_emails", { _token: token })
      .then(({ data, error }) => setState(!error && data ? "done" : "invalid"));
  }, [token]);
  const msg = {
    working: ar ? "جارٍ إلغاء الاشتراك…" : "Unsubscribing…",
    done: ar ? "تم إلغاء اشتراكك في رسائل تنبيهات البحث. ستبقى التنبيهات داخل التطبيق." : "You're unsubscribed from saved-search emails. In-app alerts continue.",
    invalid: ar ? "رابط إلغاء الاشتراك غير صالح أو منتهي." : "This unsubscribe link isn't valid.",
  }[state];
  return (
    <SiteShell>
      <PageTitle eyebrow={ar ? "البريد" : "Email"} title={ar ? "إلغاء الاشتراك" : "Unsubscribe"} />
      <div className="mx-auto max-w-2xl space-y-4 px-6 pb-20">
        <p role="status" aria-live="polite">{msg}</p>
        <Link to="/saved-searches" search={{ q: undefined, cat: undefined }} className="text-sm underline">{ar ? "إدارة إعدادات التنبيهات" : "Manage alert settings"}</Link>
      </div>
    </SiteShell>
  );
}
