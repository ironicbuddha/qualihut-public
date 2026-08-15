import assert from "node:assert/strict"
import test from "node:test"
import type { CampaignRecord } from "../src/lib/content"
import {
  contentTypeLabel,
  deriveNavigation,
  enumerateRoutePages,
  folderContextFor,
  folderLabel,
  navigationInitial,
  navigationTeaser,
  presentNavigation,
  validateRouteOwnership,
} from "../src/lib/navigation"

function record(sourcePath: string, title: string, type = "meta", body = "A player-safe paragraph."): CampaignRecord {
  return { data: { id: sourcePath, title, type }, body, sourcePath }
}

test("derives the hybrid root and immediate folder membership from records", () => {
  const navigation = deriveNavigation([
    record("index.md", "Campaign Index"),
    record("_world_state.md", "World Snapshot"),
    record("people/npcs/alice.md", "Alice", "person"),
    record("people/pcs/Ben/fren.md", "Fren", "person"),
  ])

  assert.deepEqual(navigation.root.childFolderPaths, ["people"])
  assert.deepEqual(navigation.root.childItemRoutes, ["/_world_state/"])
  assert.deepEqual(navigation.folders.get("people")?.childFolderPaths, ["people/npcs", "people/pcs"])
  assert.deepEqual(navigation.folders.get("people/npcs")?.childItemRoutes, ["/people/npcs/alice/"])
  assert.deepEqual(navigation.folders.get("people/pcs")?.childFolderPaths, ["people/pcs/Ben"])
  assert.deepEqual(navigation.folders.get("people/pcs/Ben")?.childItemRoutes, ["/people/pcs/Ben/fren/"])
  assert.deepEqual(navigation.items.map((item) => item.route), ["/", "/_world_state/", "/people/npcs/alice/", "/people/pcs/Ben/fren/"])
})

test("applies the total player-facing presentation policies", () => {
  assert.equal(folderLabel("people/npcs"), "Non-Player Characters")
  assert.equal(folderLabel("people/pcs/Niki"), "Ishtar")
  assert.equal(folderLabel("meta/session-notes"), "Session Notes")
  assert.equal(contentTypeLabel("combat-setup"), "Encounter")
  assert.equal(contentTypeLabel("race"), "Species")
  assert.throws(() => contentTypeLabel("secret-schema-value"), /unknown content type secret-schema-value/)

  const teaserRecord = record(
    "people/npcs/alice.md",
    "Alice",
    "person",
    "# Alice\n\n![](alice.png)\n\n- Ignore this list.\n\nAlice knows **the [old road](../roads.md)** and `its signs`.\n\nA later paragraph.",
  )
  assert.equal(navigationTeaser(teaserRecord), "Alice knows the old road and its signs.")
  assert.equal(navigationTeaser(record("short.md", "Short", "meta", "Brief.")), "Brief.")
  assert.equal(navigationTeaser(record("comment.md", "Comment", "meta", "<!-- internal marker -->\n\nVisible player-safe prose.")), "Visible player-safe prose.")

  const longToken = "é".repeat(181)
  const truncated = navigationTeaser(record("long.md", "Long", "meta", longToken))
  assert.equal(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(truncated.slice(0, -1)).containing(0)?.segment, "é")
  assert.equal([...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(truncated.slice(0, -1))].length, 180)
  assert.ok(truncated.endsWith("…"))
})

test("presents and enumerates one deterministic page for every item and folder", () => {
  const tree = deriveNavigation([
    record("index.md", "Campaign Index"),
    record("_world_state.md", "World Snapshot"),
    record("people/npcs/session-10.md", "Session 10", "person"),
    record("people/npcs/session-2.md", "Session 2", "person"),
    record("people/pcs/Niki/ishtar.md", "Ishtar", "person"),
  ])
  const presented = presentNavigation(tree)
  const pages = enumerateRoutePages(tree, presented)

  assert.deepEqual(presented.root.childFolders.map((folder) => [folder.label, folder.descendantItemCount]), [["People", 3]])
  assert.deepEqual(presented.folders.get("people/npcs")?.childItems.map((item) => item.title), ["Session 2", "Session 10"])
  assert.equal(presented.folders.get("people")?.metadata, "Folder Index · 2 folders")
  assert.equal(presented.folders.get("people/pcs/Niki")?.metadata, "Folder Index · 1 item")
  assert.equal(presented.folders.get("people")?.childItems.length, 0)
  assert.deepEqual(
    folderContextFor(tree.items.find((item) => item.route === "/people/pcs/Niki/ishtar/")!, presented),
    [
      { label: "Campaign Index", href: "/" },
      { label: "People", href: "/people/" },
      { label: "Player Characters", href: "/people/pcs/" },
      { label: "Ishtar", href: "/people/pcs/Niki/" },
    ],
  )
  assert.deepEqual(new Set(pages.map((page) => page.route)), new Set(["/", "/_world_state/", "/people/", "/people/npcs/", "/people/npcs/session-10/", "/people/npcs/session-2/", "/people/pcs/", "/people/pcs/Niki/", "/people/pcs/Niki/ishtar/"]))
  assert.equal(pages.filter((page) => page.route === "/").length, 1)
})

test("normalizes represented A-Z jump initials without hiding any item", () => {
  assert.equal(navigationInitial("Élodie"), "E")
  assert.equal(navigationInitial("10 Bells"), "#")
  assert.equal(navigationInitial("星"), "#")

  const records = [record("index.md", "Campaign Index")]
  records.push(...Array.from({ length: 22 }, (_, index) => record(`lore/a-${index}.md`, `A Tale ${index}`, "lore-entry")))
  records.push(record("lore/number.md", "10 Bells", "lore-entry"), record("lore/elodie.md", "Élodie", "lore-entry"))
  const presented = presentNavigation(deriveNavigation(records)).folders.get("lore")!
  assert.deepEqual(presented.jumpInitials, ["#", "A", "E"])
  assert.equal(presented.childItems.length, 24)
  assert.deepEqual(new Set(presented.childItems.map((item) => item.initial)), new Set(["#", "A", "E"]))
})

test("rejects normalized route collisions and explicit renderer ownership", () => {
  assert.throws(
    () => validateRouteOwnership(deriveNavigation([record("index.md", "Campaign Index"), record("People.md", "People"), record("people/npcs/alice.md", "Alice", "person")])),
    /route collision.*\/People\/.*item:People\.md.*folder:people/is,
  )
  assert.throws(
    () => validateRouteOwnership(deriveNavigation([record("index.md", "Campaign Index"), record("404.md", "Not Found")])),
    /route collision.*\/404\/.*explicit renderer route.*item:404\.md/is,
  )
  assert.throws(
    () => validateRouteOwnership(deriveNavigation([record("index.md", "Campaign Index"), record("Straße.md", "Street"), record("STRASSE/entry.md", "Entry")])),
    /route collision.*Straße.*STRASSE/is,
  )
})
