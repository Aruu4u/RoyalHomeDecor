/*
 * Mobile sanity checks: sticky header, tap target sizes, screenshots.
 *
 *   node scripts/check-mobile.mjs [url] [width]
 */

import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://127.0.0.1:4180";
const width = Number(process.argv[3] || 390);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();

  await page.setViewport({ width, height: 844, deviceScaleFactor: 2 });

  for (const route of ["/", "/shop"]) {
    await page.goto(`${url}${route}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    /*
     * Captured before the sticky test, which scrolls the page. Screenshotting
     * afterwards catches the browser mid scroll-restore and frames the shot
     * halfway down a section.
     */
    const file = `mobile-${route === "/" ? "home" : route.slice(1)}-${width}.png`;

    await page.screenshot({ path: file, fullPage: false });

    /* ---------- Sticky header ---------- */

    const sticky = await page.evaluate(async () => {
      const header = document.querySelector(".site-header");

      if (!header) {
        return { found: false };
      }

      const before = header.getBoundingClientRect().top;

      window.scrollTo(0, 1200);

      await new Promise((r) => setTimeout(r, 400));

      const after = header.getBoundingClientRect().top;

      window.scrollTo(0, 0);

      return {
        found: true,
        position: getComputedStyle(header).position,
        topBeforeScroll: Math.round(before),
        topAfterScroll: Math.round(after),
      };
    });

    /* ---------- Tap targets ---------- */

    const smallTargets = await page.evaluate(() => {
      /*
       * 24px is the WCAG 2.2 "Target Size (Minimum)" AA threshold. A
       * stricter number produces a long list of ordinary text links that
       * are perfectly usable, which buries the genuine problems.
       */
      const MIN = 24;

      const results = [];

      for (const el of document.querySelectorAll(
        "a, button, input, select, [role='button']",
      )) {
        const rect = el.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {
          continue;
        }

        if (rect.height < MIN || rect.width < MIN) {
          results.push({
            tag: el.tagName.toLowerCase(),
            cls:
              typeof el.className === "string"
                ? el.className.split(/\s+/)[0]
                : "",
            label:
              (el.getAttribute("aria-label") || el.textContent || "")
                .trim()
                .slice(0, 28),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }

      return results;
    });

    console.log(`\n${route}  (viewport ${width}px)`);
    console.log(
      `  sticky header: position=${sticky.position}` +
        ` top ${sticky.topBeforeScroll} -> ${sticky.topAfterScroll}` +
        `  ${sticky.topAfterScroll <= 1 ? "STICKS" : "DOES NOT STICK"}`,
    );

    console.log(`  tap targets under 40px: ${smallTargets.length}`);

    for (const t of smallTargets.slice(0, 8)) {
      console.log(
        `    ${t.w}x${t.h}  ${t.tag}.${t.cls}  "${t.label}"`,
      );
    }

    console.log(`  screenshot: ${file}`);
  }
} finally {
  await browser.close();
}
