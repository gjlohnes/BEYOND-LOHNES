import { expect, test } from '@playwright/test';

test('FIELD loop persists and remains deterministic offline', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();

  await page.locator('input[name="energy"]').fill('1');
  await page.locator('input[name="stress"]').fill('1');
  await page.locator('input[name="mood"]').fill('4');
  await page.locator('input[name="soreness"]').fill('0');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
  await expect(page.getByRole('heading', { name: 'Start a reset' })).toBeVisible();

  await page.getByRole('link', { name: 'WHY' }).click();
  await expect(page.getByText('STABILIZE: matched — RED capacity', { exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'ACCEPT' }).click();
  await expect(page).toHaveURL(/#\/reset/);
  await page.getByLabel('Intensity').selectOption('5');
  await page.getByRole('button', { name: 'START RESET' }).click();
  await page.getByRole('button', { name: 'COMPLETE RESET' }).click();
  await page.getByRole('link', { name: 'Return to TODAY' }).click();

  await page.getByRole('link', { name: 'VIEW HISTORY' }).click();
  await expect(page.getByText('RESET_COMPLETED')).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Command' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Command' })).toBeVisible();
  await page.locator('input[name="energy"]').fill('5');
  await page.locator('input[name="stress"]').fill('1');
  await page.locator('input[name="mood"]').fill('5');
  await page.locator('input[name="soreness"]').fill('0');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
  await expect(page.getByRole('heading', { name: 'No action required' })).toBeVisible();
  await page.getByRole('link', { name: 'WHY' }).click();
  await expect(page.getByText('No higher-priority rule matched.', { exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'END DAY' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'START DAY' })).toBeVisible();
});
