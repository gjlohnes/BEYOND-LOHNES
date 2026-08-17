import { expect, test } from '@playwright/test';

test('WORK day records shift end and deterministically recommends SHIFT DOWN',async({page,context})=>{
  await page.goto('/#/today');
  await page.getByRole('button',{name:'START WORK DAY'}).click();
  await expect(page.getByText('Context: WORK · ACTIVE',{exact:true})).toBeVisible();

  await page.locator('input[name="energy"]').fill('3');
  await page.locator('input[name="stress"]').fill('3');
  await page.locator('input[name="mood"]').fill('3');
  await page.locator('input[name="soreness"]').fill('1');
  await page.locator('input[name="alcoholUrge"]').fill('0');
  await page.getByRole('button',{name:'REASSESS'}).click();
  await expect(page.getByRole('heading',{name:'No action required'})).toBeVisible();

  await page.getByRole('button',{name:'SHIFT ENDED'}).click();
  await expect(page.getByText('Context: WORK · POST SHIFT',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'State check-in required'})).toBeVisible();

  await page.getByRole('button',{name:'REASSESS'}).click();
  await expect(page.getByRole('heading',{name:'Shift down'})).toBeVisible();
  await page.getByRole('link',{name:'WHY'}).click();
  await expect(page.getByText('SHIFT_DOWN: matched — Explicit work-ended fact without completed SHIFT DOWN',{exact:true})).toBeVisible();
  await page.goBack();

  await page.getByRole('button',{name:'ACCEPT'}).click();
  await expect(page.getByRole('button',{name:'COMPLETE SHIFT DOWN'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'COMPLETE SHIFT DOWN'})).toBeVisible();
  await page.getByRole('button',{name:'COMPLETE SHIFT DOWN'}).click();
  await expect(page.getByRole('status')).toContainText('SHIFT DOWN completed and stored.');

  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Context: WORK · POST SHIFT',{exact:true})).toBeVisible();
});
