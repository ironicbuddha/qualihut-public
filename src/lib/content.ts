import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import matter from "gray-matter"

export const contentDirectory = resolve(process.cwd(), "content")

export type CampaignRecord = {
  data: CampaignFrontmatter
  body: string
  sourcePath: string
}

export type CampaignFrontmatter = { id: string; title: string; type: string }

function findMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name)
    if (entry.isDirectory()) return findMarkdownFiles(fullPath)
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : []
  })
}

export function sourcePathFromFile(filePath: string): string {
  return relative(contentDirectory, filePath).replaceAll("\\", "/")
}

export function routeSegments(sourcePath: string): string[] {
  if (sourcePath === "index.md") return []
  return sourcePath.replace(/\.md$/, "").split("/")
}

export function routeForSource(sourcePath: string): string {
  const segments = routeSegments(sourcePath)
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`
}

function parseCampaignRecord(filePath: string): CampaignRecord {
  const parsed = matter(readFileSync(filePath, "utf8"))
  const keys = Object.keys(parsed.data).sort()
  const data = parsed.data as CampaignFrontmatter
  if (keys.join(",") !== "id,title,type" || !Object.values(data).every((value) => typeof value === "string" && value.length > 0)) {
    throw new Error(`${sourcePathFromFile(filePath)}: frontmatter must contain exactly non-empty id, title, and type fields`)
  }
  return { data, body: parsed.content, sourcePath: sourcePathFromFile(filePath) }
}

export function getCampaignRecords(): CampaignRecord[] {
  return findMarkdownFiles(contentDirectory)
    .map(parseCampaignRecord)
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))
}

export function resolveContentPath(sourcePath: string, target: string): string {
  return relative(contentDirectory, resolve(contentDirectory, dirname(sourcePath), target)).replaceAll("\\", "/")
}

export function isLocalAsset(sourcePath: string): boolean {
  return existsSync(resolve(contentDirectory, sourcePath))
}
