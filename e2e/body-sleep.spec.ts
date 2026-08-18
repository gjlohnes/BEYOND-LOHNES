import { expect, test } from '@playwright/test';

test('BODY sleep persists and remains visible offline', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'BODY' }).click();

  await page.getByLabel('Sleep hours').fill('7');
  await page.getByLabel('Sleep minutes').fill('30');
  await page.getByRole('button', { name: 'LOG SLEEP' }).click();
  await expect(page.getByText('Sleep: 7 hr 30 min', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Sleep: 7 hr 30 min', { exact: true })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Sleep: 7 hr 30 min', { exact: true })).toBeVisible();
});
