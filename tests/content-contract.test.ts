import assert from "node:assert/strict"
import test from "node:test"
import { getCampaignRecords, routeForSource } from "../src/lib/content"
import { getTableOfContents, renderMarkdown, resolveImageSource, resolveMarkdownLink } from "../src/lib/markdown"

test("maps the authored Campaign Index to the root", () => {
  assert.equal(routeForSource("index.md"), "/")
})

test("maps nested records deterministically", () => {
  assert.equal(routeForSource("people/pcs/Niki/ishtar-sheet.md"), "/people/pcs/Niki/ishtar-sheet/")
})

test("rewrites an anchored relative Markdown link", () => {
  assert.equal(resolveMarkdownLink("locations/banco-valdieri-bankhouse.md", "../institutions/banco-valdieri.md#what-players-would-know"), "/institutions/banco-valdieri/#what-players-would-know")
})

test("rewrites a colocated image", () => {
  assert.equal(resolveImageSource("locations/banco-valdieri-bankhouse.md", "images/banco-valdieri-bankhouse.png"), "/media/locations/images/banco-valdieri-bankhouse.png")
})

test("renders GFM tables and heading anchors", () => {
  const html = renderMarkdown("## Records\n\n| Name | Value |\n| --- | --- |\n| A | B |", "index.md")
  assert.match(html, /<table>/)
  assert.match(html, /id="records"/)
})

test("derives in-page navigation IDs from the same Markdown parser", () => {
  assert.deepEqual(getTableOfContents("## Briefing: [Banco Valdieri](institutions/banco-valdieri.md) Investigation\n\n### Illustration (player-safe)\n\n### Illustration (player-safe)"), [
    { level: 2, text: "Briefing: Banco Valdieri Investigation", id: "briefing%3A-banco-valdieri-investigation" },
    { level: 3, text: "Illustration (player-safe)", id: "illustration-(player-safe)" },
    { level: 3, text: "Illustration (player-safe)", id: "illustration-(player-safe)-1" },
  ])
})

test("includes every source record", () => {
  assert.equal(getCampaignRecords().length, 236)
})
