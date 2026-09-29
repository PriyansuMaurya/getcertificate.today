import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const desktop = { width: 1440, height: 900 };
const viewportWidths = [320, 375, 640, 768, 1024, 1280, 1440, 1920];
const authFrames = [
  { path: '/login', bounds: { x: 480, y: 101, width: 480, height: 698 } },
  { path: '/signup', bounds: { x: 480, y: 56.5, width: 480, height: 787 } },
];

if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
  throw new Error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run the full Figma UI check.');
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: desktop });

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  const landingFrame = await page
    .locator('img[alt="getcertificate.today product preview"]')
    .evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        pageHeight: document.documentElement.scrollHeight,
        sectionHeights: [...document.querySelectorAll('header,section,footer')].map(
          (element) => element.getBoundingClientRect().height
        ),
      };
    });
  for (const [dimension, expected] of Object.entries({
    x: 786,
    y: 242,
    width: 574,
    height: 407,
    pageHeight: 4477,
  })) {
    assert.ok(
      Math.abs(landingFrame[dimension] - expected) <= 1,
      `landing ${dimension}: expected ${expected}, received ${landingFrame[dimension]}`
    );
  }
  const expectedSectionHeights = [80, 731, 623, 707, 607, 897, 461, 371];
  landingFrame.sectionHeights.forEach((height, index) => {
    assert.ok(
      Math.abs(height - expectedSectionHeights[index]) <= 1,
      `landing section ${index + 1}: expected ${expectedSectionHeights[index]}, received ${height}`
    );
  });

  for (const frame of authFrames) {
    await page.goto(`${baseUrl}${frame.path}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);

    const expectedHeading = frame.path === '/login' ? 'Welcome back' : 'Create your account';
    await page.getByRole('heading', { name: expectedHeading }).waitFor({ state: 'visible' });
    const providerAction = frame.path === '/login' ? 'Sign in' : 'Sign up';
    for (const provider of ['Google', 'GitHub']) {
      const button = page.getByRole('button', {
        name: `${providerAction} with ${provider}`,
        exact: true,
      });
      if ((await button.count()) > 0) await button.waitFor({ state: 'visible' });
    }

    if (frame.path === '/signup') {
      await page.getByPlaceholder('Minimum 8 characters').waitFor({ state: 'visible' });
      await page
        .getByRole('button', { name: 'Create Account', exact: true })
        .waitFor({ state: 'visible' });
    }

    const actual = await page.locator('h1').evaluate((heading) => {
      const rect = heading.parentElement.parentElement.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });

    for (const [dimension, expected] of Object.entries(frame.bounds)) {
      assert.ok(
        Math.abs(actual[dimension] - expected) <= 1,
        `${frame.path} ${dimension}: expected ${expected}, received ${actual[dimension]}`
      );
    }
  }

  for (const path of ['/', '/login', '/signup']) {
    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      assert.ok(
        layout.scrollWidth <= layout.clientWidth,
        `${path} overflows horizontally at ${width}px (${layout.scrollWidth}px)`
      );
    }
  }

  if (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email Address').fill(process.env.TEST_USER_EMAIL);
    await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 15000 });

    const sidebar = page.getByRole('complementary', { name: 'Dashboard navigation' });
    await sidebar.waitFor({ state: 'visible' });
    const sidebarWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
    assert.ok(
      Math.abs(sidebarWidth - 280) <= 1,
      `dashboard sidebar: expected 280, received ${sidebarWidth}`
    );
    await page.getByRole('link', { name: 'Dashboard', exact: true }).waitFor({ state: 'visible' });
    await sidebar.getByText('My Learning', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByText('N/A', { exact: true }).count(), 3);
    await page
      .locator('[aria-disabled="true"][title="Search is not available yet"]')
      .waitFor({ state: 'visible' });

    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(
        layout.scrollWidth <= layout.clientWidth,
        `/dashboard overflows horizontally at ${width}px (${layout.scrollWidth}px)`
      );
      if (width < 1024) {
        const menu = page.locator('summary[aria-label="Open dashboard navigation"]');
        await menu.waitFor({ state: 'visible' });
        if (width === 320) {
          await menu.focus();
          await menu.press('Enter');
          assert.equal(await page.locator('details').evaluate((element) => element.open), true);
          await menu.press('Enter');
          assert.equal(await page.locator('details').evaluate((element) => element.open), false);
        }
      }
    }
  }

  console.log('Figma layout and responsive checks passed.');
} finally {
  await browser.close();
}
