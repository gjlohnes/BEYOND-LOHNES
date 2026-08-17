import { expect, test, type Page } from '@playwright/test';

async function submitGreenCheckIn(page: Page) {
  await page.locator('input[name="energy"]').fill('5');
  await page.locator('input[name="stress"]').fill('1');
  await page.locator('input[name="mood"]').fill('5');
  await page.locator('input[name="soreness"]').fill('0');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
}

test('override to RESET records the decision and enters the selected command flow', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await submitGreenCheckIn(page);
  await expect(page.getByRole('heading', { name: 'No action required' })).toBeVisible();

  await page.getByRole('button', { name: 'RESET' }).click();
  await expect(page).toHaveURL(/#\/reset\?recommendationId=/);
  await page.getByRole('button', { name: 'START RESET' }).click();
  await expect(page.getByRole('status')).toContainText('RESET started. BODY BEFORE STORY.');
});

test('override to SHIFT DOWN records, completes, and preserves the selected command flow', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await submitGreenCheckIn(page);
  await expect(page.getByRole('heading', { name: 'No action required' })).toBeVisible();

  await page.getByRole('button', { name: 'SHIFT DOWN' }).first().click();
  await expect(page.getByText('Decision: OVERRIDDEN', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'COMPLETE SHIFT DOWN' }).click();
  await expect(page.getByRole('status')).toContainText('SHIFT DOWN completed and stored.');

  await page.getByRole('link', { name: 'VIEW HISTORY' }).click();
  await expect(page.getByText('SHIFT_DOWN_COMPLETED')).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.getByText('Decision: OVERRIDDEN', { exact: true })).toBeVisible();
});
