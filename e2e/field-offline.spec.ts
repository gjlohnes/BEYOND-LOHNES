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
  await page.getByLabel('Intensity').fill('5');
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
  await expect(page.getByRole('button', { name: 'START DAY' })).toBeVisible();
  await page.reload();
  try {
    await expect(page.getByRole('button', { name: 'START DAY' })).toBeVisible();
  } catch (error) {
    console.log('FINAL_OFFLINE_RELOAD_BODY:', await page.locator('body').innerText());
    throw error;
  }
});

test('accepting a YELLOW recovery recommendation gives immediate visible feedback', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.locator('input[name="energy"]').fill('4');
  await page.locator('input[name="stress"]').fill('2');
  await page.locator('input[name="mood"]').fill('2');
  await page.locator('input[name="soreness"]').fill('1');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
  await expect(page.getByRole('heading', { name: 'Protect recovery' })).toBeVisible();

  await page.getByRole('button', { name: 'ACCEPT' }).click();
  await expect(page.getByRole('status')).toContainText('Recommendation accepted.');
  await expect(page.getByText('Decision: ACCEPTED', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ACCEPT' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'DISMISS' })).toHaveCount(0);
});

test('a decided recommendation restores its decision state after reload', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.locator('input[name="energy"]').fill('2');
  await page.locator('input[name="stress"]').fill('4');
  await page.locator('input[name="mood"]').fill('2');
  await page.locator('input[name="soreness"]').fill('1');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button', { name: 'REASSESS' }).click();
  await expect(page.getByRole('heading', { name: 'Protect recovery' })).toBeVisible();
  await page.getByRole('button', { name: 'ACCEPT' }).click();
  await expect(page.getByText('Decision: ACCEPTED', { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Protect recovery' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Recommendation accepted.');
  await expect(page.getByText('Decision: ACCEPTED', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ACCEPT' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'DISMISS' })).toHaveCount(0);
  await expect(page.getByText('RECOMMENDATION_ALREADY_DECIDED')).toHaveCount(0);
});

test('backup restore requires explicit validation preview before replacement', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'MORE' }).click();

  const exportDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT BACKUP' }).click();
  const exportDownload = await exportDownloadPromise;
  const exportedPath = await exportDownload.path();
  expect(exportedPath).not.toBeNull();

  await page.getByLabel('Backup file').setInputFiles(exportedPath!);
  await expect(page.getByText(/Selected:/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'VALIDATE BACKUP' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'REPLACE RESTORE' })).toHaveCount(0);

  await page.getByRole('button', { name: 'VALIDATE BACKUP' }).click();
  await expect(page.getByText('Backup valid.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Days 1 · Events/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'REPLACE RESTORE' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const safetyDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'REPLACE RESTORE' }).click();
  const safetyDownload = await safetyDownloadPromise;
  expect(safetyDownload.suggestedFilename()).toContain('beyond-pre-restore-safety-');
  await expect(
    page.getByText('Restore completed. Current data was exported first.', { exact: true }),
  ).toBeVisible();
});

test('BODY logs water and protein as persistent offline events', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'START DAY' }).click();
  await page.getByRole('link', { name: 'BODY' }).click();

  await page.getByLabel('Water (oz)').fill('40');
  await page.getByRole('button', { name: 'LOG WATER' }).click();
  await expect(page.locator('p').filter({ hasText: 'Water:' })).toContainText('40 oz');

  await page.getByLabel('Protein (g)').fill('35');
  await page.getByRole('button', { name: 'LOG PROTEIN' }).click();
  await expect(page.locator('p').filter({ hasText: 'Protein:' })).toContainText('35 g');

  await page.reload();
  await expect(page.locator('p').filter({ hasText: 'Water:' })).toContainText('40 oz');
  await expect(page.locator('p').filter({ hasText: 'Protein:' })).toContainText('35 g');
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Water (oz)').fill('24');
  await page.getByRole('button', { name: 'LOG WATER' }).click();
  await expect(page.locator('p').filter({ hasText: 'Water:' })).toContainText('64 oz');
});
