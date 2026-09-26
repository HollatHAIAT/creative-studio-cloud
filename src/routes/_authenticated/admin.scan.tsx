import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useLocale, type Key } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/admin/scan")({
  head: () => ({ meta: [
    { title: "Ticket check-in — creativestudio" }, { name: "description", content: "Staff QR scanner for exhibition entry." },
    { property: "og:title", content: "Ticket check-in — creativestudio" }, { property: "og:description", content: "Scan tickets at the door." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <StaffGate><Scan /></StaffGate>,
});

type Result = { result: string; ticket_type: string | null; exhibition_id: string | null; visit_date: string | null; slot: string | null; used_at: string | null };

function Scan() {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const [on, setOn] = useState(false);
  const [code, setCode] = useState("");
  const [res, setRes] = useState<(Result & { code: string }) | null>(null);

  const recent = useQuery({ queryKey: ["admin", "scans"], queryFn: async () => (await supabase.from("ticket_scans").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [] });
  const check = useMutation({
    mutationFn: async (c: string) => {
      const { data, error } = await supabase.rpc("check_in_ticket", { _code: c });
      if (error) throw error;
      return { ...(data?.[0] as Result), code: c };
    },
    onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ["admin", "scans"] }); },
    onSettled: () => { busy.current = false; },
  });

  useEffect(() => {
    if (!on) return;
    let raf = 0; let stopped = false;
    (async () => {
      const jsQR = (await import("jsqr")).default;
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!video.current || stopped) return;
      video.current.srcObject = stream.current; await video.current.play();
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        const v = video.current;
        if (v && v.readyState === v.HAVE_ENOUGH_DATA && !busy.current) {
          canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
          const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          const last = lastCode.current;
          if (hit?.data && !(last && last.code === hit.data && Date.now() - last.at < 4000)) {
            lastCode.current = { code: hit.data, at: Date.now() }; busy.current = true; check.mutate(hit.data);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })().catch(() => setOn(false));
    return () => { stopped = true; cancelAnimationFrame(raf); stream.current?.getTracks().forEach((x) => x.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const ok = res?.result === "valid";
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.admin")} title={t("adm.scan")} />
      <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-sm bg-muted"><video ref={video} muted playsInline className={`h-full w-full object-cover ${on ? "" : "hidden"}`} /></div>
          <button onClick={() => setOn(!on)} className="mt-3 w-full rounded-full bg-primary py-3 text-primary-foreground">{on ? t("scan.stop") : t("scan.start")}</button>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) check.mutate(code.trim()); }} className="mt-4 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder={t("scan.manual")} dir="ltr" className="flex-1 rounded-full border border-border bg-background px-4 py-2 font-mono text-sm" />
            <button className="rounded-full border border-border px-4 py-2 text-sm">{t("scan.check")}</button>
          </form>
        </div>
        <div>
          {res && (
            <div role="status" className={`rounded-sm p-6 ${ok ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
              <p className="font-display text-3xl">{t(`scan.${res.result}` as Key)}</p>
              <p className="mt-2 font-mono text-sm" dir="ltr">{res.code}</p>
              {res.exhibition_id && <p className="mt-1 text-sm">{res.exhibition_id} · {res.visit_date} · {res.slot} · {res.ticket_type}</p>}
              {res.used_at && <p className="text-sm">{t("scan.at")}: {fmtDateTime(res.used_at, locale)}</p>}
            </div>
          )}
          <h2 className="mt-6 font-display text-2xl">{t("scan.recent")}</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recent.data?.map((s) => <li key={s.id} className="flex justify-between py-2"><span className="font-mono" dir="ltr">{s.code}</span><span>{t(`scan.${s.result}` as Key)}</span><span className="text-muted-foreground">{fmtDateTime(s.created_at, locale)}</span></li>)}
          </ul>
        </div>
      </div>
    </SiteShell>
  );
}
