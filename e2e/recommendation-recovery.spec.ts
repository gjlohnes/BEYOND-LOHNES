import { expect, test, type Page } from '@playwright/test';

async function submitYellowCheckIn(page: Page) {
  await page.locator('input[name="energy"]').fill('2');
  await page.locator('input[name="stress"]').fill('4');
  await page.locator('input[name="mood"]').fill('2');
  await page.locator('input[name="soreness"]').fill('1');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
}

test('accepting RECOVER starts the recovery-session path instead of dead-ending at the decision', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await submitYellowCheckIn(page);

  await expect(page.getByRole('heading', { name: 'Protect recovery' })).toBeVisible();
  await page.getByRole('button', { name: 'ACCEPT' }).click();

  await expect(page).toHaveURL(/#\/train$/);
  await expect(page.getByRole('heading', { name: 'Recovery session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'END RECOVERY' })).toBeVisible();

  await page.getByLabel('Recovery minutes').fill('10');
  await page.getByRole('button', { name: 'END RECOVERY' }).click();
  await expect(page.getByRole('status')).toContainText('Recovery session completed.');
});
