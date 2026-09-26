import type { ReactNode } from "react";
import { SiteShell } from "@/components/SiteShell";
import { useStaff } from "@/lib/auth";
import { useLocale } from "@/lib/i18n";

/** UI gate only — the database enforces staff access on every read and action. */
export function StaffGate({ children }: { children: ReactNode }) {
  const { isStaff, loading } = useStaff();
  const { t } = useLocale();
  if (loading) return <SiteShell><p className="p-16 text-center">…</p></SiteShell>;
  if (!isStaff) return <SiteShell><p className="p-16 text-center">{t("adm.notStaff")}</p></SiteShell>;
  return <>{children}</>;
}
