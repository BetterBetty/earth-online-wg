import { chromium } from 'file:///C:/Users/Pro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'preview-mobile.png', fullPage: true })
await browser.close()

