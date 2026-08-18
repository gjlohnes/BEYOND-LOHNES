import { expect, test } from '@playwright/test';

test('BODY sleep persists and remains visible offline', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'BODY' }).click();

  await page.getByLabel('Hours').fill('7');
  await page.getByLabel('Minutes').fill('30');
  await page.getByRole('button', { name: 'LOG SLEEP' }).click();
  const sleepMetric = page.locator('.metric-card').filter({ hasText: 'SLEEP' });
  await expect(sleepMetric.getByText('7 hr 30 min', { exact: true })).toBeVisible();

  await page.reload();
  await expect(sleepMetric.getByText('7 hr 30 min', { exact: true })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(sleepMetric.getByText('7 hr 30 min', { exact: true })).toBeVisible();
});
