import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 390, 768, 1440]) {
  test(`Diseño, recursos y accesibilidad a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // Recorrer la página activa los recursos con carga diferida antes de validarlos.
    for (const image of await page.locator('img[loading="lazy"]').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu compra.Bajo control.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('La demo conserva la lista y actualiza el contador al cambiar de vista', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Descubre miZesta', exact: true }).first().click();
  await expect(page).toHaveURL(/#descubre$/);
  const check = page.getByRole('checkbox', { name: 'Marcar Aguacates como comprado' });
  await check.check();
  await expect(page.locator('[data-demo] [data-list-count]')).toHaveText('2 de 5');
  await expect(page.getByRole('status')).toHaveText('2 de 5 productos comprados');
  await page.getByRole('tab', { name: /Compara/ }).click();
  await expect(page.locator('#panel-compare')).toBeVisible();
  await expect(page.locator('#panel-list')).toBeHidden();
  await page.getByRole('tab', { name: /Controla/ }).click();
  await expect(page.locator('#panel-expenses')).toBeVisible();
  await page.getByRole('tab', { name: /Organiza/ }).click();
  await expect(check).toBeChecked();
  await check.uncheck();
  await expect(page.locator('[data-demo] [data-list-count]')).toHaveText('1 de 5');
});

test('La lista admite todos los productos marcados y ninguno', async ({ page }) => {
  await page.goto('/#descubre');
  const checks = page.getByRole('checkbox');
  for (const input of await checks.all()) await input.check();
  await expect(page.locator('[data-demo] [data-list-count]')).toHaveText('5 de 5');
  for (const input of await checks.all()) await input.uncheck();
  await expect(page.locator('[data-demo] [data-list-count]')).toHaveText('0 de 5');
  await expect(page.locator('[data-demo] .list-total strong')).toHaveText('10,14 €');
});

test('Teclado: flechas, Inicio, Fin y espacio', async ({ page }) => {
  await page.goto('/#descubre');
  await page.getByRole('tab', { name: /Organiza/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Compara/ })).toBeFocused();
  await expect(page.locator('#panel-compare')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /Controla/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Organiza/ })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /Controla/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: /Organiza/ })).toBeFocused();
  const check = page.getByRole('checkbox', { name: 'Marcar Aguacates como comprado' });
  await check.focus();
  await page.keyboard.press('Space');
  await expect(check).toBeChecked();
});

test('Las vistas de comparación y gastos también son accesibles', async ({ page }) => {
  await page.goto('/#descubre');
  for (const name of [/Compara/, /Controla/]) {
    await page.getByRole('tab', { name }).click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});

test('Respeta movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  expect(await page.locator('.button').first().evaluate((button) => getComputedStyle(button).transitionDuration)).toBe('0s');
});

test('Sin JavaScript mantiene la presentación y la lista inicial', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#panel-list')).toBeVisible();
  await expect(page.locator('#panel-list .product-row')).toHaveCount(5);
  await page.getByRole('link', { name: 'Descubre miZesta', exact: true }).first().click();
  await expect(page).toHaveURL(/#descubre$/);
  await context.close();
});

test('Todos los enlaces locales apuntan a secciones existentes', async ({ page }) => {
  await page.goto('/');
  const invalid = await page.locator('a[href^="#"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? '').filter((href) => !document.querySelector(href)));
  expect(invalid).toEqual([]);
});
