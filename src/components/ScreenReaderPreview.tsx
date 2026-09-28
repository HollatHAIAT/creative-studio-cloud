import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, SkipForward, SkipBack } from "lucide-react";
import { useLocale } from "@/lib/i18n";

type Seg = { role: string; text: string };

/**
 * Reads the listing aloud in the order a screen reader would announce it (image alt → medium → heading → description → tags → button),
 * using the device's built-in voices. Shows the transcript and highlights the part being spoken.
 */
export function ScreenReaderPreview({ lang, alt, title, medium, description, tags, hasImage }: {
  lang: "en" | "ar"; alt: string; title: string; medium: string; description: string; tags: string[]; hasImage: boolean;
}) {
  const { locale } = useLocale(); const L = (e: string, a: string) => (locale === "ar" ? a : e);
  const ar = lang === "ar";
  const segs = useMemo<Seg[]>(() => {
    const s: Seg[] = [];
    if (hasImage) s.push({ role: ar ? "صورة" : "Image", text: alt.trim() || (ar ? "بلا وصف" : "unlabelled image") });
    if (medium.trim()) s.push({ role: ar ? "نص" : "Text", text: medium.trim() });
    s.push({ role: ar ? "عنوان، المستوى 3" : "Heading level 3", text: title.trim() || (ar ? "بلا عنوان" : "untitled") });
    if (description.trim()) description.trim().split(/\n+/).forEach((p) => s.push({ role: ar ? "فقرة" : "Paragraph", text: p }));
    if (tags.length) s.push({ role: ar ? "نص" : "Text", text: tags.map((t) => `#${t}`).join(" ") });
    s.push({ role: ar ? "زر" : "Button", text: ar ? "اشترِ الآن" : "Buy now" });
    return s;
  }, [ar, alt, title, medium, description, tags, hasImage]);

  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState(1);
  const [at, setAt] = useState(-1);
  const playing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setSupported(false); return; }
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", load); window.speechSynthesis.cancel(); };
  }, []);
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  useEffect(() => { stop(); setVoice(""); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  function speakFrom(i: number) {
    const synth = window.speechSynthesis; synth.cancel();
    if (i < 0 || i >= segs.length) { playing.current = false; setAt(-1); return; }
    playing.current = true; setAt(i);
    const seg = segs[i]!;
    const u = new SpeechSynthesisUtterance(`${seg.role}. ${seg.text}`);
    u.lang = ar ? "ar-SA" : "en-US"; u.rate = rate;
    const v = langVoices.find((x) => x.name === voice) ?? langVoices[0]; if (v) u.voice = v;
    u.onend = () => { if (playing.current) speakFrom(i + 1); };
    synth.speak(u);
  }
  function stop() { playing.current = false; if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); setAt(-1); }

  const btn = "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50";
  return (
    <section aria-labelledby="srp-h" className="space-y-3 rounded-xl bg-muted p-3 text-sm">
      <h4 id="srp-h" className="font-medium">{L("Screen-reader preview", "معاينة قارئ الشاشة")}</h4>
      <p className="text-muted-foreground">{L("Hear the order a screen reader announces your listing in. It uses your device's voice, so it sounds different from real screen readers.", "استمع إلى الترتيب الذي يقرأ به قارئ الشاشة إعلانك. يستخدم صوت جهازك، لذا يختلف قليلاً عن قارئات الشاشة الحقيقية.")}</p>
      {!supported ? <p role="alert" className="text-destructive">{L("This browser can't read text aloud. The transcript below shows the order.", "هذا المتصفح لا يدعم القراءة الصوتية. يوضح النص أدناه الترتيب.")}</p> : (
        <div className="flex flex-wrap items-center gap-2">
          {at < 0
            ? <button type="button" className={`${btn} border-primary bg-primary text-primary-foreground`} onClick={() => speakFrom(0)}><Play className="h-3.5 w-3.5" aria-hidden />{L("Listen", "استمع")}</button>
            : <button type="button" className={btn} onClick={stop}><Square className="h-3.5 w-3.5" aria-hidden />{L("Stop", "إيقاف")}</button>}
          <button type="button" className={btn} disabled={at <= 0} onClick={() => speakFrom(at - 1)} aria-label={L("Previous item", "العنصر السابق")}><SkipBack className="h-3.5 w-3.5" /></button>
          <button type="button" className={btn} disabled={at < 0} onClick={() => speakFrom(at + 1)} aria-label={L("Next item", "العنصر التالي")}><SkipForward className="h-3.5 w-3.5" /></button>
          <label className="inline-flex items-center gap-1">{L("Speed", "السرعة")}
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="rounded-full border border-border bg-background px-2 py-1">
              {[0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
            </select></label>
          {langVoices.length > 1 && (
            <label className="inline-flex items-center gap-1">{L("Voice", "الصوت")}
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="max-w-[12rem] rounded-full border border-border bg-background px-2 py-1">
                {langVoices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select></label>)}
          {langVoices.length === 0 && voices.length > 0 && <span className="text-xs text-warning">{ar ? L("No Arabic voice on this device — it may read with an English voice.", "لا يوجد صوت عربي على هذا الجهاز — قد يُقرأ بصوت إنجليزي.") : L("No English voice found on this device.", "لا يوجد صوت إنجليزي على هذا الجهاز.")}</span>}
        </div>)}
      <ol dir={ar ? "rtl" : "ltr"} lang={lang} className="space-y-1" aria-label={L("Transcript", "النص المقروء")}>
        {segs.map((s, i) => (
          <li key={i} aria-current={i === at ? "true" : undefined} className={`rounded-lg px-2 py-1 transition ${i === at ? "bg-primary/15 ring-1 ring-primary" : ""}`}>
            <span className="text-xs text-muted-foreground">{s.role}</span> · {s.text}
          </li>))}
      </ol>
    </section>
  );
}
