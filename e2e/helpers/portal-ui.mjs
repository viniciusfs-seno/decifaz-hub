import {expect} from '@playwright/test'
export async function openDisclosure(page,title){
 const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),summary=page.locator('summary').filter({hasText:new RegExp('^'+escaped)}).first()
 await expect(summary).toBeVisible()
 if(await summary.locator('..').getAttribute('open')===null)await summary.click()
}
export async function recordTab(page,label){const tab=page.getByRole('tab',{name:label,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true')}
export async function proposalStep(dialog,label){const step=dialog.locator('.proposal-steps').getByRole('button',{name:new RegExp(label)});await step.click();await expect(step).toHaveAttribute('aria-current','step')}
