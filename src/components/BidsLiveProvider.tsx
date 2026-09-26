import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeBidsLive } from "@/lib/auctions";

/** Mounted once at the root: one realtime channel for all auction cards; they read from the query cache. */
export function BidsLiveProvider() {
  const qc = useQueryClient();
  useEffect(() => subscribeBidsLive(supabase as never, () => {
    qc.invalidateQueries({ queryKey: ["auctions"] });
    qc.invalidateQueries({ queryKey: ["reserve"] });
  }), [qc]);
  return null;
}
