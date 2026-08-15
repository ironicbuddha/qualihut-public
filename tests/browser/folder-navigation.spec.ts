import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { getCampaignRecords } from "../../src/lib/content"
import { deriveNavigation, enumerateRoutePages, presentNavigation } from "../../src/lib/navigation"

const tree = deriveNavigation(getCampaignRecords())
const navigation = presentNavigation(tree)
const routePages = enumerateRoutePages(tree, navigation)
const folderPages = routePages.filter((page) => page.kind === "folder-page")
const representativeRoutes = ["/", "/people/", "/magic/", "/people/pcs/Niki/", "/institutions/", "/people/pcs/Niki/ishtar-sheet/", "/_world_state/"]
const siteBaseUrl = process.env.PUBLIC_SITE_BASE_URL ?? "http://127.0.0.1:4371"

function monitorRuntimeErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`)
  })
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`))
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`))
  return errors
}

test("renders a folder-only parent with its immediate children", async ({ page }) => {
  const response = await page.goto("/people/")

  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible()
  const people = navigation.folders.get("people")!
  await expect(page.getByText(people.metadata, { exact: true })).toBeVisible()
  await expect(page.locator("[data-folder-entry] .folder-entry-label")).toHaveText(people.childFolders.map((folder) => folder.label))
  await expect(page.locator("[data-item-entry]")).toHaveCount(0)
})

test("serves every emitted item and Folder Index route", async ({ request }) => {
  for (const routePage of routePages) {
    const response = await request.get(routePage.route)
    expect(response.status(), routePage.route).toBe(200)
  }
})

test("renders every Folder Index from its model-backed immediate children", async ({ page }) => {
  const runtimeErrors = monitorRuntimeErrors(page)
  for (const routePage of folderPages) {
    await page.goto(routePage.route)
    expect(await page.locator("[data-folder-entry] > a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(routePage.folder.childFolders.map((folder) => folder.route))
    await expect(page.locator("[data-folder-entry] .folder-entry-label")).toHaveText(routePage.folder.childFolders.map((folder) => folder.label))
    await expect(page.locator("[data-folder-entry] .folder-entry-count")).toHaveText(routePage.folder.childFolders.map((folder) => `${folder.descendantItemCount} ${folder.descendantItemCount === 1 ? "item" : "items"}`))
    expect(await page.locator("[data-item-entry] a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(routePage.folder.childItems.map((item) => item.route))
    await expect(page.locator("[data-item-entry] a")).toHaveText(routePage.folder.childItems.map((item) => item.title))
    await expect(page.locator("[data-item-entry] .item-type")).toHaveText(routePage.folder.childItems.map((item) => item.typeLabel))
    await expect(page.locator("[data-item-entry] p")).toHaveText(routePage.folder.childItems.map((item) => item.teaser))
  }
  expect(runtimeErrors).toEqual([])
})

test("keeps the Campaign Index curated and appends the generated root browse ledger", async ({ page }) => {
  await page.goto("/")
  const browse = page.getByRole("heading", { level: 2, name: "Browse campaign notes" })
  await expect(browse).toBeVisible()
  await expect(page.locator(".root-browse [data-folder-entry] .folder-entry-label")).toHaveText(navigation.root.childFolders.map((folder) => folder.label))
  await expect(page.locator(".root-browse [data-item-entry] a")).toHaveText(navigation.root.childItems.map((item) => item.title))
  expect(await page.locator("article h2").allTextContents()).toContain("Browse campaign notes")
  await expect(page.getByText("Folder Index", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "Folder Context" })).toHaveCount(0)
})

test("renders deep item Folder Context without sibling discovery", async ({ page }) => {
  const itemPage = routePages.find((candidate) => candidate.kind === "item-page" && candidate.route === "/people/pcs/Niki/ishtar-sheet/")
  if (!itemPage || itemPage.kind !== "item-page") throw new Error("missing Ishtar route fixture")
  await page.goto(itemPage.route)

  const context = page.getByRole("navigation", { name: "Folder Context" })
  await expect(context.getByRole("link")).toHaveText(itemPage.folderContext.map((crumb) => crumb.label))
  expect(await context.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(itemPage.folderContext.map((crumb) => crumb.href))
  await expect(context.locator("[aria-current='page']")).toHaveText(itemPage.item.record.data.title)
  await expect(page.locator("[data-item-entry], [data-folder-entry]")).toHaveCount(0)
})

test("renders JavaScript-free A-Z jumps with the complete large-folder ledger", async ({ page }) => {
  const institutions = navigation.folders.get("institutions")!
  await page.goto("/institutions/")

  await expect(page.getByRole("navigation", { name: "Jump to initial" }).getByRole("link")).toHaveText(institutions.jumpInitials)
  await expect(page.locator("[data-item-entry]")).toHaveCount(institutions.childItems.length)
  for (const initial of institutions.jumpInitials) {
    const id = initial === "#" ? "initial-other" : `initial-${initial.toLocaleLowerCase("en")}`
    await expect(page.locator(`#${id}`)).toBeVisible()
  }
  const firstJump = page.getByRole("navigation", { name: "Jump to initial" }).getByRole("link").first()
  const href = await firstJump.getAttribute("href")
  await firstJump.click()
  await expect(page).toHaveURL(new RegExp(`${href!.replace("#", "#")}$`))
  await expect(page.locator("[data-item-entry]")).toHaveCount(institutions.childItems.length)
})

test("traverses the deep folder path and A-Z ledger with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: siteBaseUrl, javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto("/")
  await page.locator(".root-browse [data-folder-entry] a[href='/people/']").click()
  await page.locator("[data-folder-entry] a[href='/people/pcs/']").click()
  await page.locator("[data-folder-entry] a[href='/people/pcs/Niki/']").click()
  await page.locator("[data-item-entry] a[href='/people/pcs/Niki/ishtar-sheet/']").click()
  await expect(page).toHaveURL(/\/people\/pcs\/Niki\/ishtar-sheet\/$/)
  await page.getByRole("navigation", { name: "Folder Context" }).getByRole("link", { name: "Ishtar", exact: true }).click()
  await expect(page).toHaveURL(/\/people\/pcs\/Niki\/$/)
  await page.goto("/institutions/")
  const itemCount = await page.locator("[data-item-entry]").count()
  await page.getByRole("navigation", { name: "Jump to initial" }).getByRole("link").first().click()
  expect(await page.locator("[data-item-entry]").count()).toBe(itemCount)
  await context.close()
})

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`has no automated WCAG A or AA violations on representative routes at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    for (const route of representativeRoutes) {
      await page.goto(route)
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      expect(results.violations, route).toEqual([])
    }
  })
}

test("supports keyboard focus and 320px page reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const route of representativeRoutes) {
    await page.goto(route)
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflows, route).toBe(false)
  }
  await page.goto("/people/")
  await page.keyboard.press("Tab")
  await expect(page.locator(":focus-visible")).toBeVisible()
  expect(await page.locator(":focus-visible").evaluate((element) => element.tagName)).toBe("A")
})
