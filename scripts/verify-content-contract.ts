import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { getCampaignRecords, isLocalAsset, resolveContentPath, routeForSource } from "../src/lib/content"
import { renderMarkdown, resolveImageSource, resolveMarkdownLink } from "../src/lib/markdown"

const records = getCampaignRecords()
const recordPaths = new Set(records.map((record) => record.sourcePath))
const recordsByPath = new Map(records.map((record) => [record.sourcePath, record]))
const errors: string[] = []
const linkPattern = /(?<!!?)\[[^\]]*\]\((?<target>[^\s)]+)(?:\s+[^)]*)?\)/g
const imagePattern = /!\[[^\]]*\]\((?<target>[^\s)]+)(?:\s+[^)]*)?\)/g

for (const record of records) {
  for (const match of record.body.matchAll(linkPattern)) {
    const target = match.groups?.target ?? ""
    const [path, fragment] = target.split("#", 2)
    if (path.endsWith(".md")) {
      const targetPath = resolveContentPath(record.sourcePath, path)
      const targetRecord = recordsByPath.get(targetPath)
      if (!recordPaths.has(targetPath)) errors.push(`${record.sourcePath}: unresolved Markdown link ${target}`)
      if (targetRecord && fragment && !renderMarkdown(targetRecord.body, targetPath).includes(`id="${decodeURIComponent(fragment)}"`)) errors.push(`${record.sourcePath}: unresolved Markdown anchor ${target}`)
    }
  }
  for (const match of record.body.matchAll(imagePattern)) {
    const target = match.groups?.target ?? ""
    if (!target.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      const assetPath = resolveContentPath(record.sourcePath, target)
      if (!isLocalAsset(assetPath)) errors.push(`${record.sourcePath}: unresolved image ${target}`)
      if (isLocalAsset(assetPath) && !existsSync(resolve(process.cwd(), "public/media", assetPath))) errors.push(`${record.sourcePath}: image was not copied ${target}`)
    }
  }
}

const root = records.find((record) => record.sourcePath === "index.md")
const nested = records.find((record) => record.sourcePath.split("/").length > 3)
if (!root || routeForSource(root.sourcePath) !== "/") errors.push("content/index.md must map to the root route")
if (!nested || !routeForSource(nested.sourcePath).startsWith("/")) errors.push("a nested record route is missing")
if (!root?.body.includes("| Name | Short reminder |")) errors.push("Campaign Index table coverage is missing")
if (resolveMarkdownLink("locations/banco-valdieri-bankhouse.md", "../institutions/banco-valdieri.md#what-players-would-know") !== "/institutions/banco-valdieri/#what-players-would-know") errors.push("anchored relative links are not transformed")
if (resolveImageSource("locations/banco-valdieri-bankhouse.md", "images/banco-valdieri-bankhouse.png") !== "/media/locations/images/banco-valdieri-bankhouse.png") errors.push("relative images are not transformed")
if (!existsSync(resolve(process.cwd(), "content"))) errors.push("content source directory is missing")

if (errors.length > 0) throw new Error(`Content contract failed:\n${errors.join("\n")}`)
console.log(`Content contract passed for ${records.length} Markdown records.`)
