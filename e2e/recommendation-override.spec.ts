import { expect, test, type Page } from '@playwright/test';

async function submitGreenCheckIn(page: Page) {
  await page.locator('input[name="energy"]').fill('5');
  await page.locator('input[name="stress"]').fill('1');
  await page.locator('input[name="mood"]').fill('5');
  await page.locator('input[name="soreness"]').fill('0');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
}

test('override RESET survives reload and completes the selected command flow', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await submitGreenCheckIn(page);
  await expect(page.getByRole('heading', { name: 'No action required' })).toBeVisible();

  await page.getByRole('button', { name: 'RESET' }).click();
  await expect(page).toHaveURL(/#\/reset\?recommendationId=/);
  await page.getByRole('button', { name: 'START RESET' }).click();
  await expect(page.getByRole('status')).toContainText('RESET started. BODY BEFORE STORY.');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('RESET in progress.');
  await expect(page.getByLabel('Intensity')).toBeDisabled();
  await page.getByRole('button', { name: 'COMPLETE RESET' }).click();
  await expect(page.getByRole('status')).toContainText('RESET completed and stored.');

  await page.getByRole('link', { name: 'Return to TODAY' }).click();
  await expect(page.getByText('Decision: OVERRIDDEN', { exact: true })).toBeVisible();
});

test('override SHIFT DOWN survives reload, completes, and preserves the selected command flow', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await submitGreenCheckIn(page);
  await expect(page.getByRole('heading', { name: 'No action required' })).toBeVisible();

  await page.getByRole('button', { name: 'SHIFT DOWN' }).first().click();
  await expect(page.getByText('Decision: OVERRIDDEN', { exact: true })).toBeVisible();
  await expect(page.getByText('SHIFT DOWN in progress.', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('SHIFT DOWN in progress.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'COMPLETE SHIFT DOWN' }).click();
  await expect(page.getByRole('status')).toContainText('SHIFT DOWN completed and stored.');

  await page.getByRole('link', { name: 'VIEW HISTORY' }).click();
  await expect(page.getByText('SHIFT_DOWN_COMPLETED')).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByText('Decision: OVERRIDDEN', { exact: true })).toBeVisible();
});
