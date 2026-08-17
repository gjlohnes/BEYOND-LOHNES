import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test('invalid backup is rejected before replacement without exposing internal error codes', async ({ page }) => {
  await page.goto('/#/more');
  await page.getByLabel('Backup file').setInputFiles({
    name: 'not-a-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ definitely not valid json'),
  });

  await expect(page.getByRole('button', { name: 'VALIDATE BACKUP' })).toBeVisible();
  await page.getByRole('button', { name: 'VALIDATE BACKUP' }).click();

  await expect(page.getByRole('status')).toContainText('That file is not valid JSON.');
  await expect(page.getByRole('button', { name: 'REPLACE RESTORE' })).toHaveCount(0);
  await expect(page.getByText('INVALID_BACKUP_JSON')).toHaveCount(0);
});
