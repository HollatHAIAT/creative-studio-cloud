import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { licenseRates } from "./license-rates";

export type PlatformSettings = {
  return_days: number; print_ship_min_days: number; print_ship_max_days: number;
  commercial_print_limit: number; commercial_multiplier: number; extended_multiplier: number;
};

/** Defaults match the seeded row; used until the database answers. */
export const DEFAULT_SETTINGS: PlatformSettings = {
  return_days: 14, print_ship_min_days: 5, print_ship_max_days: 7,
  commercial_print_limit: 5000, commercial_multiplier: 4, extended_multiplier: 10,
};


export function applySettings(s: PlatformSettings) {
  licenseRates.commercial = Number(s.commercial_multiplier);
  licenseRates.extended = Number(s.extended_multiplier);
}

export async function fetchSettings(client: typeof supabase = supabase): Promise<PlatformSettings> {
  const { data } = await (client as any).from("platform_settings").select("return_days, print_ship_min_days, print_ship_max_days, commercial_print_limit, commercial_multiplier, extended_multiplier").eq("id", 1).maybeSingle();
  const s = { ...DEFAULT_SETTINGS, ...(data ?? {}) } as PlatformSettings;
  applySettings(s);
  return s;
}

export function usePlatformSettings(): PlatformSettings {
  const q = useQuery({ queryKey: ["platform-settings"], queryFn: () => fetchSettings(), staleTime: 60_000 });
  return q.data ?? DEFAULT_SETTINGS;
}

/** Formats a number with Arabic-Indic digits in Arabic. */
export const num = (n: number, ar: boolean) => n.toLocaleString(ar ? "ar-SA" : "en-US");
