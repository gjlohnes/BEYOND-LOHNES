import { expect, test } from '@playwright/test';

test('REDUCED workout uses two exercises, two sets each, and advances rotation', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'TRAIN' }).click();

  await expect(page.getByRole('heading', { name: /Next: Workout A/ })).toBeVisible();
  await page.getByRole('button', { name: 'REDUCED WORKOUT' }).click();

  await expect(page.getByRole('heading', { name: 'Workout A · REDUCED' })).toBeVisible();
  await expect(page.getByText('Two exercises · two sets each. Reduced work is legitimate work.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Machine Chest Press' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pec Deck' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leg Press' })).toHaveCount(0);

  await page.getByLabel('Machine Chest Press set 1 weight').fill('100');
  await page.getByLabel('Machine Chest Press set 1 reps').fill('10');
  await page.getByRole('button', { name: 'LOG SET' }).first().click();
  await page.getByRole('button', { name: 'COMPLETE SESSION' }).click();

  await expect(page.getByRole('heading', { name: /Next: Workout B/ })).toBeVisible();
  await expect(page.getByText('Workout A · REDUCED · PARTIAL', { exact: true })).toBeVisible();
});
