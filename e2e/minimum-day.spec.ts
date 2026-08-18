import { expect, test } from '@playwright/test';

test('MINIMUM DAY enables and preserves derived/manual essentials offline', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();

  const minimumDay = page.locator('.card').filter({
    has: page.getByRole('heading', { name: 'Minimum Day' }),
  });
  await minimumDay.getByRole('button', { name: 'ENABLE MINIMUM DAY' }).click();
  await expect(minimumDay.getByRole('status')).toContainText('MINIMUM DAY enabled');
  await expect(minimumDay).toContainText('Reduced expectations are active');

  await minimumDay.getByRole('button', { name: 'Mark Meds complete' }).click();
  await expect(minimumDay).toContainText('Meds: COMPLETE');
  await expect(minimumDay).toContainText('MANUAL');

  await page.getByRole('link', { name: 'BODY' }).click();
  await page.getByLabel('Water (oz)').fill('40');
  await page.getByRole('button', { name: 'LOG WATER' }).click();
  await page.getByLabel('Protein (g)').fill('25');
  await page.getByRole('button', { name: 'LOG PROTEIN' }).click();

  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(minimumDay).toContainText('Hydrate: COMPLETE');
  await expect(minimumDay).toContainText('Protein: COMPLETE');
  await expect(minimumDay).toContainText('Meds: COMPLETE');
  await expect(minimumDay).toContainText('AUTO');
  await expect(minimumDay).toContainText('MANUAL');

  await page.reload();
  await expect(minimumDay).toContainText('Reduced expectations are active');
  await expect(minimumDay).toContainText('Hydrate: COMPLETE');
  await expect(minimumDay).toContainText('Protein: COMPLETE');
  await expect(minimumDay).toContainText('Meds: COMPLETE');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(minimumDay).toContainText('Hydrate: COMPLETE');
  await expect(minimumDay).toContainText('Protein: COMPLETE');
  await expect(minimumDay).toContainText('Meds: COMPLETE');
});
