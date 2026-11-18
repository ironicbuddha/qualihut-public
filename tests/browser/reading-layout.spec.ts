import { expect, test } from "@playwright/test"

test("a chapter without a contents sidebar uses the reading width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/meta/tradecraft-manual/chapter-06-asset-development-and-recruitment/")
  const shell = page.locator(".reading-shell")
  await expect(shell.getByRole("navigation", { name: "On this page" })).toHaveCount(0)
  const article = shell.getByRole("article")
  const width = await article.evaluate((element) => element.clientWidth)
  expect(width).toBeGreaterThan(700)
})
