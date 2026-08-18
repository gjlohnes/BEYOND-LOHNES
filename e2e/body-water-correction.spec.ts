import { expect, test } from '@playwright/test';

test('BODY corrects a mistaken water entry and preserves effective truth offline', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'BODY' }).click();

  await page.getByLabel('Water (oz)').fill('160');
  await page.getByRole('button', { name: 'LOG WATER' }).click();
  await expect(page.getByRole('status')).toContainText('160 oz water logged.');

  await page.getByLabel('Water (oz)').fill('24');
  await page.getByRole('button', { name: 'LOG WATER' }).click();
  await expect(page.getByText('184 oz', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'CORRECT' }).first().click();
  await expect(page.getByRole('heading', { name: 'Correct water entry' })).toBeVisible();
  await expect(page.getByText(/Original history preserved|original entry remains in history/i)).toBeVisible();
  await page.getByLabel('Correct amount (oz)').fill('16');
  await page.getByRole('button', { name: 'CONFIRM CORRECTION' }).click();

  await expect(page.getByRole('status')).toContainText('Water entry corrected to 16 oz.');
  await expect(page.getByText('40 oz', { exact: true })).toBeVisible();
  await expect(page.getByText(/corrected 1x/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText('40 oz', { exact: true })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('40 oz', { exact: true })).toBeVisible();
});
