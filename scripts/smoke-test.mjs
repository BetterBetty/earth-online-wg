import { chromium } from 'file:///C:/Users/Pro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

assert((await page.title()) === '地球Online WG', '页面标题不正确')
assert(await page.getByText('今日主线').isVisible(), '今日页面没有显示')

await page.locator('.task-check').first().click()
assert(await page.getByText('等级提升').isVisible(), '完成任务没有触发升级弹层')
await page.getByRole('button', { name: '继续地球Online' }).click()

await page.locator('.fab').click()
await page.getByPlaceholder('输入一个清晰、可完成的任务').fill('测试发布一项新任务')
await page.getByRole('button', { name: /发布任务/ }).last().click()
assert(await page.getByText('测试发布一项新任务').isVisible(), '新任务没有加入今日页面')

await page.locator('.bottom-nav button').filter({ hasText: '奖励' }).click()
await page.getByRole('button', { name: '立即兑换' }).first().click()
assert(await page.getByText('确认核销').isVisible(), '兑换后没有生成奖券')
await page.screenshot({ path: 'preview-reward.png', fullPage: true })
await page.getByRole('button', { name: '撤销兑换' }).click()
await page.locator('.segmented-control button').filter({ hasText: '历史' }).click()
assert(await page.getByText(/已退款/).isVisible(), '奖券退款没有进入历史')

await page.locator('.bottom-nav button').filter({ hasText: '日程' }).click()
await page.locator('.icon-button').click()
assert(await page.getByText('完整月历预览').isVisible(), '完整月历没有展开')

await page.locator('.fab').click()
await page.getByPlaceholder('输入一个清晰、可完成的任务').fill('阅读一个新主题')
await page.getByRole('button', { name: /学习副本/ }).click()
await page.getByPlaceholder('例如：B站、公众号、朋友推荐').fill('公众号')
await page.screenshot({ path: 'preview-task-modal.png', fullPage: true })

await browser.close()
console.log('Smoke test passed: today, level-up, add task, reward voucher, refund, schedule, learning task modal')

