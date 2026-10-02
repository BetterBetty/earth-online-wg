import { chromium } from 'file:///C:/Users/Pro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })

const assert = (condition, message) => { if (!condition) throw new Error(message) }
assert(await page.getByText('今日主线').isVisible(), '今日页面没有显示')
assert(await page.getByRole('heading', { name: '今日任务' }).isVisible(), '今日任务分区缺失')
assert(await page.getByRole('heading', { name: '学习副本' }).isVisible(), '学习副本没有独立分区')

const firstTask = page.locator('.task-card').first()
await firstTask.getByRole('button', { name: '更多操作' }).click()
await page.getByRole('button', { name: '修改任务' }).click()
await page.locator('.task-modal input').first().fill('完成第二版体验反馈')
await page.getByRole('button', { name: /保存修改/ }).click()
assert(await page.getByText('完成第二版体验反馈').isVisible(), '任务修改未保存')

await page.locator('.bottom-nav button').filter({ hasText: '日程' }).click()
const cards = page.locator('.schedule-card')
const before = await cards.first().getAttribute('data-task-id')
const handle = cards.first().getByRole('button', { name: /长按拖动/ })
const target = cards.nth(1)
const hb = await handle.boundingBox(); const tb = await target.boundingBox()
if (hb && tb) {
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down(); await page.waitForTimeout(380)
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 5 }); await page.mouse.up()
}
assert((await cards.first().getAttribute('data-task-id')) !== before, '长按拖动没有改变顺序')

await page.locator('.bottom-nav button').filter({ hasText: '奖励' }).click()
await page.getByRole('button', { name: /自定义新奖励/ }).click()
await page.getByPlaceholder('例如：吃一顿大餐').fill('周末喝一杯奶茶')
await page.getByRole('button', { name: '加入奖励库' }).click()
assert(await page.getByText('周末喝一杯奶茶').isVisible(), '自定义奖励没有加入奖励库')
const customReward = page.locator('.reward-card').filter({ hasText: '周末喝一杯奶茶' })
await customReward.getByRole('button', { name: '管理奖励' }).click()
await page.getByRole('button', { name: '修改奖励' }).click()
await page.locator('.reward-modal input').nth(1).fill('周末奶茶券')
await page.getByRole('button', { name: '保存奖励' }).click()
assert(await page.getByText('周末奶茶券').isVisible(), '奖励修改未保存')

await page.locator('.bottom-nav button').filter({ hasText: '成长' }).click()
await page.getByRole('button', { name: /累计完成任务数/ }).click()
assert(await page.locator('.detail-modal').getByText('累计完成任务数').isVisible(), '累计数据不可点击查看历史')
await page.locator('.detail-header button').click()
await page.screenshot({ path: 'preview-v2.png', fullPage: true })

await browser.close()
console.log('V2 smoke test passed: task edit, separate learning section, touch reorder, reward CRUD, clickable growth history')

