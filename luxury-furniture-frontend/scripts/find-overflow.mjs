/*
 * Finds elements wider than the viewport, at phone width.
 *
 * Horizontal overflow is invisible on a desktop browser but wrecks a page
 * on a phone: the document grows wider than the screen, so the layout sits
 * in a narrow column with dead space beside it, and pinch-zooming reveals
 * the emptiness. Reading the stylesheets cannot reliably tell you which
 * element is responsible, because the culprit is usually the sum of
 * several boxes rather than one obviously wide rule.
 *
 * This drives an installed Chrome, so nothing is downloaded.
 *
 *   node scripts/find-overflow.mjs [url] [width]
 */

import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const url = process.argv[2] || "https://royal-home-decor.vercel.app";
const width = Number(process.argv[3] || 390);

/* iPhone-ish. Height only affects what is scrolled into view. */
const height = 844;

const routes = ["/", "/shop", "/cart", "/login"];

function describe(node) {
  return node;
}

const browser = await puppeteer.launch({
  executablePath: CHROME_CANDIDATES.find(Boolean),
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();

  /*
   * `isMobile` is off deliberately.
   *
   * With mobile emulation on, Chrome grows the layout viewport to fit
   * overflowing content, and every `position: fixed` element then reports
   * that grown width because it sizes to the initial containing block.
   * The measurements become circular: the symptom looks like the cause.
   * A plain narrow viewport shows which element is genuinely too wide.
   */
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  });

  /*
   * With --no-guard the root's `overflow-x: clip` is switched off, so the
   * measurement shows real overflow rather than overflow that is merely
   * being cropped. Used to prove the underlying layout is actually fixed
   * and the guard is only a safety net.
   */
  const withoutGuard = process.argv.includes("--no-guard");

  for (const route of routes) {
    await page.goto(`${url}${route}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    if (withoutGuard) {
      await page.addStyleTag({
        content: "html, body { overflow-x: visible !important; }",
      });
    }

    /* Let lazy sections and images settle before measuring. */
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const result = await page.evaluate((viewportWidth) => {
      const doc = document.documentElement;

      const offenders = [];

      for (const el of document.querySelectorAll("*")) {
        const rect = el.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
          continue;
        }

        /*
         * `right` beyond the viewport means this box sticks out. A couple
         * of pixels is rounding, so only report a real excess.
         */
        const overhang = Math.round(rect.right - viewportWidth);

        if (overhang <= 2) {
          continue;
        }

        /*
         * Note whether an ancestor clips this box. A clipped element
         * cannot widen the document, but it is still worth listing: the
         * clipping ancestor is often where the real problem lives.
         */
        let clippedBy = "";

        for (let p = el.parentElement; p; p = p.parentElement) {
          const style = getComputedStyle(p);

          if (
            style.overflowX === "hidden" ||
            style.overflowX === "clip" ||
            style.overflowX === "auto" ||
            style.overflowX === "scroll"
          ) {
            clippedBy =
              (p.tagName.toLowerCase() +
                (typeof p.className === "string" && p.className
                  ? `.${p.className.split(/\s+/)[0]}`
                  : "")) || "ancestor";
            break;
          }
        }

        offenders.push({
          clippedBy,
          tag: el.tagName.toLowerCase(),
          cls:
            typeof el.className === "string"
              ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")
              : "",
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          overhang,
        });
      }

      offenders.sort((a, b) => b.overhang - a.overhang);

      /*
       * Elements that leak: their own content is wider than their box, and
       * overflow-x is visible, so the excess passes up to the document.
       * This is what actually widens the page, and it is easy to miss by
       * eye because the element itself looks the right size.
       */
      const leaks = [];

      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);

        if (style.overflowX !== "visible") {
          continue;
        }

        const excess = el.scrollWidth - el.clientWidth;

        if (excess > 2 && el.clientWidth > 0) {
          leaks.push({
            tag: el.tagName.toLowerCase(),
            cls:
              typeof el.className === "string"
                ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")
                : "",
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            excess,
          });
        }
      }

      leaks.sort((a, b) => b.excess - a.excess);

      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offenders: offenders.slice(0, 10),
        leaks: leaks.slice(0, 10),
      };
    }, width);

    const excess = result.scrollWidth - result.clientWidth;

    console.log(`\n${route}`);
    console.log(
      `  document: scrollWidth=${result.scrollWidth} clientWidth=${result.clientWidth}` +
        `  -> ${excess > 0 ? `OVERFLOW of ${excess}px` : "no overflow"}`,
    );

    if (result.offenders.length === 0) {
      console.log("  no unclipped element extends past the viewport");
      continue;
    }

    console.log("  boxes past the right edge:");

    for (const o of result.offenders.map(describe)) {
      const name = o.cls ? `${o.tag}.${o.cls}` : o.tag;

      console.log(
        `    +${String(o.overhang).padStart(5)}px  ${name}` +
          `   (w=${o.width} right=${o.right})` +
          (o.clippedBy ? `   [clipped by ${o.clippedBy}]` : "   [NOT clipped]"),
      );
    }

    if (result.leaks.length > 0) {
      console.log("  elements leaking overflow upward (overflow-x: visible):");

      for (const l of result.leaks) {
        const name = l.cls ? `${l.tag}.${l.cls}` : l.tag;

        console.log(
          `    +${String(l.excess).padStart(5)}px  ${name}` +
            `   (client=${l.clientWidth} scroll=${l.scrollWidth})`,
        );
      }
    }
  }
} finally {
  await browser.close();
}
