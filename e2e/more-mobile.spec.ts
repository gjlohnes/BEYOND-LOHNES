import { expect, test } from '@playwright/test';

test('MORE diagnostics remains inside a narrow phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#/more');

  await expect(page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
  await expect(page.getByText('Recommendations', { exact: true })).toBeVisible();
  await expect(page.getByText('Performed sets', { exact: true })).toBeVisible();
  await expect(page.getByText('Last backup recorded in restored data', { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
