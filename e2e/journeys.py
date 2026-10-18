"""End-to-end journeys through the public site, run in a real browser.
Usage: python3 e2e/journeys.py [base_url]   (default http://localhost:8080). Exits non-zero on any failure."""
import asyncio, sys
from playwright.async_api import async_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
failures: list[str] = []

async def step(name, fn):
    try:
        await fn(); print("PASS", name)
    except Exception as e:  # noqa: BLE001
        failures.append(name); print("FAIL", name, "-", str(e).splitlines()[0][:200])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 1280, "height": 1800})).new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        async def browse_to_artwork():
            await page.goto(f"{BASE}/explore"); await page.wait_for_load_state("networkidle")
            await page.locator('a[href^="/artwork/"]').first.click()
            await page.wait_for_url("**/artwork/**"); await expect(page.locator("h1").first).to_be_visible()
        await step("buyer: explore → artwork page", browse_to_artwork)

        async def checkout_needs_signin():
            await page.goto(f"{BASE}/checkout"); await page.wait_for_load_state("networkidle")
            assert "/auth" in page.url or await page.get_by_text("Sign in").count() > 0, page.url
        await step("buyer: checkout asks signed-out visitors to sign in", checkout_needs_signin)

        async def company_pages():
            for path, text in [("/about", "Our commitments"), ("/licensing", "How it works"), ("/support", "Common questions")]:
                await page.goto(f"{BASE}{path}"); await expect(page.get_by_text(text).first).to_be_visible()
        await step("company: About, Licensing and FAQ render their texts", company_pages)

        async def footer_links():
            await page.goto(BASE); await page.locator("footer").get_by_role("link", name="Licensing").click()
            await page.wait_for_url("**/licensing")
        await step("footer: links open their pages", footer_links)

        async def auctions_and_exhibitions():
            for path in ["/auctions", "/exhibitions", "/supplies", "/advisor"]:
                r = await page.goto(f"{BASE}{path}"); assert r and r.status < 400, f"{path} {r and r.status}"
        await step("browse: auctions, exhibitions, supplies, advisor load", auctions_and_exhibitions)

        async def admin_blocked():
            await page.goto(f"{BASE}/admin/users"); await page.wait_for_load_state("networkidle")
            assert "/auth" in page.url, page.url
        await step("security: admin pages send signed-out visitors to sign in", admin_blocked)

        async def no_crashes():
            assert not errors, errors[:3]
        await step("no page crashed along the way", no_crashes)
        await b.close()
    print(f"\n{len(failures)} failed" if failures else "\nall journeys passed")
    sys.exit(1 if failures else 0)

asyncio.run(main())
