import { expect, test, type Page } from "@playwright/test"

const session = () => `e2e-${Math.random().toString(36).slice(2, 10)}`

async function open(page: Page, id: string) {
  await page.goto(`/t/${id}?session=${id}`)
  await expect(page.getByRole("button", { name: "Start feedback mode" })).toBeVisible()
}

async function activate(page: Page) {
  // Fresh pages always load collapsed; click and let Playwright auto-wait.
  await page.getByRole("button", { name: "Start feedback mode" }).click()
  await expect(page.locator("[data-feedback-toolbar][data-agentation-toolbar]")).toBeVisible()
}

async function addNote(page: Page, text: string) {
  const posted = page.waitForResponse(
    (response) =>
      response.url().includes("/annotations") && response.request().method() === "POST",
  )
  await page.locator("#content .line span").first().click()
  await page.locator("[data-annotation-popup] textarea").fill(text)
  await page.getByRole("button", { name: "Add" }).click()
  // Wait for the server round-trip so the pre-fix duplicate window is covered.
  await posted
  await expect(page.locator("[data-annotation-marker]")).toHaveCount(1)
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL })
})

test("copies one note once, with its anchor, and keeps it after reload", async ({ page }) => {
  const id = session()
  await open(page, id)
  await activate(page)
  await addNote(page, "Fix the spacing")

  await page.getByRole("button", { name: "Copy feedback" }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())

  // The duplicate-id bug put the same note in the clipboard twice.
  expect(text.match(/Fix the spacing/g) ?? []).toHaveLength(1)
  expect(text).toContain("**Anchor:** src/example.ts:42")

  await page.reload()
  await activate(page)
  await expect(page.locator("[data-annotation-marker]")).toHaveCount(1)
})

test("syncs created and deleted annotations across two tabs", async ({ context }) => {
  const id = session()
  const a = await context.newPage()
  const b = await context.newPage()
  await Promise.all([open(a, id), open(b, id)])
  await Promise.all([activate(a), activate(b)])

  await addNote(a, "Shared note")
  await expect(b.locator("[data-annotation-marker]")).toHaveCount(1, { timeout: 10_000 })

  await a.locator("[data-annotation-marker]").first().click()
  await a.getByRole("button", { name: "Delete annotation" }).click()
  await expect(b.locator("[data-annotation-marker]")).toHaveCount(0, { timeout: 10_000 })

  await a.close()
  await b.close()
})

test("keeps the expanded toolbar inside a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await open(page, session())
  await activate(page)

  const metrics = await page
    .locator("[data-feedback-toolbar][data-agentation-toolbar]")
    .evaluate((element) => {
      // The outer pill contains absolutely positioned tooltips; measure the
      // actual pill body and its visible buttons instead.
      const inner = element.querySelector<HTMLElement>('[class*="toolbarContainer"]') ?? element
      const rect = inner.getBoundingClientRect()
      const buttons = [...inner.querySelectorAll("button")]
        .filter((button) => button.offsetParent !== null)
        .map((button) => button.getBoundingClientRect().right)
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        buttonRight: Math.max(...buttons, 0),
      }
    })

  expect(metrics.width).toBeGreaterThan(200) // expanded, not the 44px launcher
  expect(metrics.left).toBeGreaterThanOrEqual(0)
  expect(metrics.right).toBeLessThanOrEqual(320)
  expect(metrics.buttonRight).toBeLessThanOrEqual(320)
})
