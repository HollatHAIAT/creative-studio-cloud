// Server-only: fetches watched pages via Firecrawl and records line-level changes since the last check.

/** Normalised, de-duplicated meaningful lines of a page. */
export function toLines(md: string): string[] {
  const seen = new Set<string>();
  for (const raw of md.split("\n")) {
    const l = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    if (l.length < 3 || /^[-*_#|>\s]+$/.test(l)) continue;
    seen.add(l);
  }
  return [...seen];
}

/** Lines added and removed between two versions (order-insensitive). */
export function diffLines(before: string, after: string) {
  const a = new Set(toLines(before)), b = new Set(toLines(after));
  return { added: [...b].filter((l) => !a.has(l)).slice(0, 200), removed: [...a].filter((l) => !b.has(l)).slice(0, 200) };
}

async function scrape(url: string): Promise<string> {
  const lovable = process.env["LOVABLE_API_KEY"], fc = process.env["FIRECRAWL_API_KEY"];
  if (!lovable || !fc) throw new Error("Page checking is not configured.");
  const res = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": fc },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Firecrawl scrape failed [${res.status}] ${url}: ${body.slice(0, 300)}`);
    if (res.status === 402 || body.includes("Credit limit")) throw new Error("Out of page-check credits.");
    throw new Error(`Couldn't fetch the page (${res.status}).`);
  }
  const j = JSON.parse(body);
  const md = j.data?.markdown ?? j.markdown;
  if (typeof md !== "string") throw new Error("The page returned no readable text.");
  return md;
}

/** Checks the given (or all active) pages. Returns how many changed. */
export async function runPageChecks(onlyId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("watch_pages").select("id,url,last_content").eq("active", true);
  if (onlyId) q = q.eq("id", onlyId);
  const { data: pages, error } = await q.limit(100);
  if (error) throw error;
  let changed = 0, failed = 0;
  for (const p of pages ?? []) {
    try {
      const md = await scrape(p.url);
      if (p.last_content != null) {
        const d = diffLines(p.last_content, md);
        if (d.added.length || d.removed.length) {
          await supabaseAdmin.from("watch_changes").insert({ page_id: p.id, added: d.added, removed: d.removed });
          changed++;
        }
      }
      await supabaseAdmin.from("watch_pages").update({ last_content: md.slice(0, 200_000), last_checked_at: new Date().toISOString(), last_error: null }).eq("id", p.id);
    } catch (e) {
      failed++;
      await supabaseAdmin.from("watch_pages").update({ last_checked_at: new Date().toISOString(), last_error: e instanceof Error ? e.message : "Check failed" }).eq("id", p.id);
      if (e instanceof Error && e.message.startsWith("Out of")) break;
    }
  }
  return { checked: pages?.length ?? 0, changed, failed };
}
