import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:3000';
const OUT = '.hero-qa';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1600, height: 900 },
  { name: 'lg', width: 1024, height: 768 },
  { name: 'md', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
const results = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const header = document.querySelector('header');
    const hero = document.querySelector('main section');
    const certImg = hero ? hero.querySelector('img[alt*="certificate"]') : null;
    const certWrap = certImg ? certImg.parentElement : null; // image wrapper
    const backing = certWrap ? certWrap.querySelector('div[aria-hidden]') : null;
    const textCol = h1 ? h1.parentElement : null;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        width: Math.round(r.width),
        height: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
      };
    };
    // Per-line rects of the h1 using Range API.
    const lineRects = [];
    if (h1) {
      const range = document.createRange();
      range.selectNodeContents(h1);
      for (const r of range.getClientRects()) {
        if (r.width > 1 && r.height > 1) {
          lineRects.push({ left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), w: Math.round(r.width) });
        }
      }
    }
    const cs = h1 ? getComputedStyle(h1) : null;
    const lineH = cs ? parseFloat(cs.lineHeight) : 1;
    const h1r = rect(h1);
    const wrapCs = certWrap ? getComputedStyle(certWrap) : null;
    // Overflow offenders.
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 0.5) {
        offenders.push(`${el.tagName}.${String(el.className || '').slice(0, 70)} right=${Math.round(r.right)}`);
      }
      if (offenders.length >= 8) break;
    }
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      offenders,
      h1: h1r,
      h1FontSize: cs ? cs.fontSize : null,
      h1Lines: h1r && lineH ? Math.round(h1r.height / lineH) : null,
      h1LineRects: lineRects,
      textCol: rect(textCol),
      headerH: rect(header)?.height,
      hero: rect(hero),
      certImg: rect(certImg),
      certWrap: rect(certWrap),
      certWrapMarginRight: wrapCs ? wrapCs.marginRight : null,
      backing: rect(backing),
      viewportH: window.innerHeight,
      viewportW: window.innerWidth,
    };
  });

  await page.screenshot({ path: `${OUT}/${vp.name}.png`, fullPage: false });
  results.push({ viewport: vp.name, ...metrics });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
