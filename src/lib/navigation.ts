import type { CampaignRecord } from "./content"
import { routeForSource, routeSegments } from "./content"
import MarkdownIt from "markdown-it"

const folderLabelExceptions: Readonly<Record<string, string>> = {
  meta: "Campaign Notes",
  "meta/campaign": "Campaign Overview",
  "meta/sessions": "Session Recaps",
  "people/npcs": "Non-Player Characters",
  "people/pcs": "Player Characters",
  "people/pcs/Ben": "Frenunulemulo",
  "people/pcs/Niki": "Ishtar",
  "people/pcs/Roo": "Gashesh Netz",
  "people/pcs/Thandi": "Aurelia",
  "people/pcs/Warren": "Bianca Montelupo",
  races: "Species",
}

const contentTypeLabels: Readonly<Record<string, string>> = {
  briefing: "Briefing",
  "combat-setup": "Encounter",
  economy: "Trade & Goods",
  environment: "Environment",
  faction: "Faction",
  handout: "Handout",
  institution: "Institution",
  item: "Item",
  location: "Location",
  "lore-entry": "Lore",
  magic: "Magic",
  meta: "Campaign Note",
  monster: "Creature",
  person: "Character",
  race: "Species",
  "session-recap": "Session Recap",
  spell: "Spell",
}

const teaserMarkdown = new MarkdownIt({ html: false })
const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" })

export function folderLabel(folderPath: string): string {
  const exception = folderLabelExceptions[folderPath]
  if (exception) return exception
  const segment = folderPath.split("/").at(-1) ?? ""
  return segment
    .replaceAll("-", " ")
    .replace(/(^|\s)(\p{L})/gu, (_match, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase("en")}`)
}

export function contentTypeLabel(type: string): string {
  const label = contentTypeLabels[type]
  if (!label) throw new Error(`unknown content type ${type}`)
  return label
}

function visibleInlineText(children: NonNullable<ReturnType<MarkdownIt["parse"]>[number]["children"]>): string {
  return children
    .map((child) => {
      if (child.type === "text") return child.content.replace(/<!--[^]*?-->/gu, "").replace(/!\[\[[^\]]+\]\]/g, "")
      if (child.type === "code_inline") return child.content
      if (child.type === "softbreak" || child.type === "hardbreak") return " "
      return ""
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim()
}

function truncateTeaser(text: string): string {
  const graphemes = [...graphemeSegmenter.segment(text)].map((part) => part.segment)
  if (graphemes.length <= 180) return text
  const firstWindow = graphemes.slice(0, 180)
  const lastWhitespace = firstWindow.findLastIndex((grapheme) => /^\s$/u.test(grapheme))
  const kept = lastWhitespace > 0 ? firstWindow.slice(0, lastWhitespace) : firstWindow
  return `${kept.join("").trimEnd()}…`
}

export function navigationTeaser(record: CampaignRecord): string {
  const tokens = teaserMarkdown.parse(record.body, {})
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== "paragraph_open" || token.level !== 0) continue
    const inline = tokens[index + 1]
    if (inline?.type !== "inline" || !inline.children) continue
    const text = visibleInlineText(inline.children)
    if (/[\p{L}\p{N}]/u.test(text)) return truncateTeaser(text)
  }
  throw new Error(`${record.sourcePath} (${record.data.title}): no usable top-level prose paragraph for navigation teaser`)
}

export type ItemNode = {
  kind: "item"
  record: CampaignRecord
  sourcePath: string
  segments: readonly string[]
  route: string
  parentFolderPath: string | null
}

export type FolderNode = {
  kind: "folder"
  path: string
  segments: readonly string[]
  route: string
  parentPath: string | null
  childFolderPaths: string[]
  childItemRoutes: string[]
}

export type RootBrowseNode = {
  kind: "root-browse"
  path: ""
  segments: readonly []
  route: "/"
  childFolderPaths: string[]
  childItemRoutes: string[]
}

export type NavigationTree = {
  root: RootBrowseNode
  items: ItemNode[]
  folders: Map<string, FolderNode>
}

export type Breadcrumb = { label: string; href: string }

export type PresentedItemLink = {
  kind: "item-link"
  route: string
  sourcePath: string
  title: string
  typeLabel: string
  teaser: string
  initial: string
}

export type PresentedFolderLink = {
  kind: "folder-link"
  path: string
  route: string
  label: string
  descendantItemCount: number
}

export type PresentedFolderListing = {
  childFolders: readonly PresentedFolderLink[]
  childItems: readonly PresentedItemLink[]
}

export type PresentedFolder = PresentedFolderLink &
  PresentedFolderListing & {
    metadata: string
    jumpInitials: readonly string[]
  }

export type PresentedNavigation = {
  root: PresentedFolderListing
  folders: Map<string, PresentedFolder>
  items: Map<string, PresentedItemLink>
}

export type CampaignIndexPage = {
  kind: "campaign-index-page"
  route: "/"
  record: CampaignRecord
  browse: PresentedFolderListing
}

export type ItemPage = {
  kind: "item-page"
  route: string
  item: ItemNode
  folderContext: readonly Breadcrumb[]
}

export type FolderPage = {
  kind: "folder-page"
  route: string
  folder: PresentedFolder
  folderContext: readonly Breadcrumb[]
}

export type RoutePage = CampaignIndexPage | ItemPage | FolderPage

export type NavigationPresentation = {
  folderLabel(folderPath: string): string
  typeLabel(type: string): string
  excerpt(record: CampaignRecord): string
}

const defaultPresentation: NavigationPresentation = {
  folderLabel,
  typeLabel: contentTypeLabel,
  excerpt: navigationTeaser,
}

const navigationCollator = new Intl.Collator("en", { usage: "sort", sensitivity: "base", numeric: true })

function exactCompare(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareDisplayed(leftDisplay: string, leftRoute: string, rightDisplay: string, rightRoute: string): number {
  return navigationCollator.compare(leftDisplay, rightDisplay) || exactCompare(leftDisplay, rightDisplay) || exactCompare(leftRoute, rightRoute)
}

const specialLatinInitials: Readonly<Record<string, string>> = { Đ: "D", Ð: "D", Ł: "L", Ø: "O" }

export function navigationInitial(title: string): string {
  const first = graphemeSegmenter.segment(title.trim()).containing(0)?.segment ?? ""
  const folded = first.normalize("NFD").replace(/\p{M}/gu, "").toLocaleUpperCase("en")
  const candidate = specialLatinInitials[folded] ?? folded
  return /^[A-Z]$/u.test(candidate) ? candidate : "#"
}

function folderMetadata(folderCount: number, itemCount: number): string {
  const categories = [
    folderCount > 0 ? `${folderCount} ${folderCount === 1 ? "folder" : "folders"}` : "",
    itemCount > 0 ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : "",
  ].filter(Boolean)
  return ["Folder Index", ...categories].join(" · ")
}

function ancestorPaths(path: string | null): string[] {
  if (!path) return []
  const segments = path.split("/")
  return segments.map((_segment, index) => segments.slice(0, index + 1).join("/"))
}

export function folderContextFor(item: ItemNode, presented: PresentedNavigation): Breadcrumb[] {
  return [
    { label: "Campaign Index", href: "/" },
    ...ancestorPaths(item.parentFolderPath).map((path) => {
      const folder = presented.folders.get(path)
      if (!folder) throw new Error(`${item.sourcePath}: missing presented folder ${path}`)
      return { label: folder.label, href: folder.route }
    }),
  ]
}

function folderContextForFolder(folder: FolderNode, presented: PresentedNavigation): Breadcrumb[] {
  return [
    { label: "Campaign Index", href: "/" },
    ...ancestorPaths(folder.parentPath).map((path) => {
      const ancestor = presented.folders.get(path)
      if (!ancestor) throw new Error(`${folder.path}: missing presented folder ${path}`)
      return { label: ancestor.label, href: ancestor.route }
    }),
  ]
}

export function presentNavigation(tree: NavigationTree, presentation: NavigationPresentation = defaultPresentation): PresentedNavigation {
  const items = new Map<string, PresentedItemLink>()
  for (const item of tree.items) {
    let typeLabel: string
    try {
      typeLabel = presentation.typeLabel(item.record.data.type)
    } catch (error) {
      throw new Error(`${item.sourcePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const teaser = presentation.excerpt(item.record)
    if (!typeLabel.trim() || !teaser.trim()) throw new Error(`${item.sourcePath}: navigation presentation must be non-empty`)
    items.set(item.route, {
      kind: "item-link",
      route: item.route,
      sourcePath: item.sourcePath,
      title: item.record.data.title,
      typeLabel,
      teaser,
      initial: navigationInitial(item.record.data.title),
    })
  }

  const descendantCounts = new Map<string, number>()
  const countDescendants = (folder: FolderNode): number => {
    const cached = descendantCounts.get(folder.path)
    if (cached !== undefined) return cached
    const count = folder.childItemRoutes.length + folder.childFolderPaths.reduce((total, path) => total + countDescendants(tree.folders.get(path)!), 0)
    descendantCounts.set(folder.path, count)
    return count
  }

  const folderLinks = new Map<string, PresentedFolderLink>()
  for (const folder of tree.folders.values()) {
    const label = presentation.folderLabel(folder.path)
    if (!label.trim()) throw new Error(`${folder.path}: Folder Label must be non-empty`)
    folderLinks.set(folder.path, { kind: "folder-link", path: folder.path, route: folder.route, label, descendantItemCount: countDescendants(folder) })
  }

  const folders = new Map<string, PresentedFolder>()
  for (const folder of tree.folders.values()) {
    const link = folderLinks.get(folder.path)!
    const childFolders = folder.childFolderPaths
      .map((path) => folderLinks.get(path)!)
      .sort((left, right) => compareDisplayed(left.label, left.route, right.label, right.route))
    const childItems = folder.childItemRoutes
      .map((route) => items.get(route)!)
      .sort((left, right) => compareDisplayed(left.title, left.route, right.title, right.route))
    const represented = new Set(childItems.map((item) => item.initial))
    const jumpInitials = childItems.length >= 24 ? [...represented].sort((left, right) => (left === "#" ? -1 : right === "#" ? 1 : navigationCollator.compare(left, right))) : []
    folders.set(folder.path, {
      ...link,
      childFolders,
      childItems,
      metadata: folderMetadata(childFolders.length, childItems.length),
      jumpInitials,
    })
  }

  const root = {
    childFolders: tree.root.childFolderPaths
      .map((path) => folderLinks.get(path)!)
      .sort((left, right) => compareDisplayed(left.label, left.route, right.label, right.route)),
    childItems: tree.root.childItemRoutes
      .map((route) => items.get(route)!)
      .sort((left, right) => compareDisplayed(left.title, left.route, right.title, right.route)),
  }
  return { root, folders, items }
}

type RouteOwner = { route: string; owner: string }

function normalizedRoute(route: string): string {
  return route.normalize("NFC").toLocaleUpperCase("en").toLocaleLowerCase("en").normalize("NFC")
}

export function validateRouteOwnership(tree: NavigationTree, explicitRoutes: readonly string[] = ["/404/"]): void {
  const claims: RouteOwner[] = [
    ...explicitRoutes.map((route) => ({ route, owner: `explicit renderer route ${route}` })),
    ...tree.items.map((item) => ({ route: item.route, owner: `item:${item.sourcePath}` })),
    ...[...tree.folders.values()].map((folder) => ({ route: folder.route, owner: `folder:${folder.path}` })),
  ]
  const claimsByNormalizedRoute = new Map<string, RouteOwner[]>()
  for (const claim of claims) {
    const key = normalizedRoute(claim.route)
    const matches = claimsByNormalizedRoute.get(key) ?? []
    matches.push(claim)
    claimsByNormalizedRoute.set(key, matches)
  }
  const collisions = [...claimsByNormalizedRoute.entries()].filter(([, owners]) => owners.length > 1)
  if (collisions.length === 0) return
  throw new Error(
    `Route ownership validation failed:\n${collisions
      .map(([key, owners]) => `- route collision at ${owners[0].route} (normalized ${key}): ${owners.map((owner) => owner.owner).join(" conflicts with ")}`)
      .join("\n")}`,
  )
}

export function enumerateRoutePages(tree: NavigationTree, presented: PresentedNavigation): RoutePage[] {
  validateRouteOwnership(tree)
  const campaignIndex = tree.items.find((item) => item.route === "/")
  if (!campaignIndex) throw new Error("index.md: Campaign Index record is required")
  const pages: RoutePage[] = [{ kind: "campaign-index-page", route: "/", record: campaignIndex.record, browse: presented.root }]
  for (const item of tree.items) {
    if (item.route === "/") continue
    pages.push({ kind: "item-page", route: item.route, item, folderContext: folderContextFor(item, presented) })
  }
  for (const folder of tree.folders.values()) {
    pages.push({ kind: "folder-page", route: folder.route, folder: presented.folders.get(folder.path)!, folderContext: folderContextForFolder(folder, presented) })
  }
  return pages
}

function parentFolderPath(path: string): string | null {
  const separator = path.lastIndexOf("/")
  return separator === -1 ? null : path.slice(0, separator)
}

export function deriveNavigation(records: readonly CampaignRecord[]): NavigationTree {
  const items = records.map<ItemNode>((record) => {
    const segments = routeSegments(record.sourcePath)
    return {
      kind: "item",
      record,
      sourcePath: record.sourcePath,
      segments,
      route: routeForSource(record.sourcePath),
      parentFolderPath: segments.length > 1 ? segments.slice(0, -1).join("/") : null,
    }
  })
  const folders = new Map<string, FolderNode>()

  for (const item of items) {
    if (item.sourcePath === "index.md") continue
    for (let depth = 1; depth < item.segments.length; depth += 1) {
      const segments = item.segments.slice(0, depth)
      const path = segments.join("/")
      if (!folders.has(path)) {
        folders.set(path, {
          kind: "folder",
          path,
          segments,
          route: `/${path}/`,
          parentPath: parentFolderPath(path),
          childFolderPaths: [],
          childItemRoutes: [],
        })
      }
    }
  }

  const root: RootBrowseNode = { kind: "root-browse", path: "", segments: [], route: "/", childFolderPaths: [], childItemRoutes: [] }
  for (const folder of folders.values()) {
    const parent = folder.parentPath === null ? root : folders.get(folder.parentPath)
    if (!parent) throw new Error(`${folder.path}: missing parent folder ${folder.parentPath}`)
    parent.childFolderPaths.push(folder.path)
  }
  for (const item of items) {
    if (item.sourcePath === "index.md") continue
    const parent = item.parentFolderPath === null ? root : folders.get(item.parentFolderPath)
    if (!parent) throw new Error(`${item.sourcePath}: missing parent folder ${item.parentFolderPath}`)
    parent.childItemRoutes.push(item.route)
  }

  root.childFolderPaths.sort()
  root.childItemRoutes.sort()
  for (const folder of folders.values()) {
    folder.childFolderPaths.sort()
    folder.childItemRoutes.sort()
  }
  return { root, items, folders }
}
