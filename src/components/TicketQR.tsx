import { useEffect, useState } from "react";

export function TicketQR({ code, size = 140 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then((Q) => Q.toDataURL(code, { width: size * 2, margin: 1 })).then((u) => live && setSrc(u));
    return () => { live = false; };
  }, [code, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR ${code}`} className="rounded-sm bg-background" /> : <div style={{ width: size, height: size }} className="animate-pulse rounded-sm bg-muted" />;
}
