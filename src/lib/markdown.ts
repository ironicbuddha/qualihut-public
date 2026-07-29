import MarkdownIt from "markdown-it"
import anchor from "markdown-it-anchor"
import { isLocalAsset, resolveContentPath, routeForSource } from "./content"

const externalScheme = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

export function headingId(text: string): string {
  return encodeURIComponent(String(text).trim().toLowerCase().replace(/\s+/g, "-"))
}

function splitFragment(target: string): [string, string] {
  const fragmentIndex = target.indexOf("#")
  return fragmentIndex === -1 ? [target, ""] : [target.slice(0, fragmentIndex), target.slice(fragmentIndex)]
}

function isRelative(target: string): boolean {
  return target !== "" && !target.startsWith("/") && !externalScheme.test(target)
}

export function resolveMarkdownLink(sourcePath: string, target: string): string {
  const [path, fragment] = splitFragment(target)
  if (!isRelative(path) || !path.endsWith(".md")) return target
  return `${routeForSource(resolveContentPath(sourcePath, path))}${fragment}`
}

export function resolveImageSource(sourcePath: string, target: string): string {
  if (!isRelative(target)) return target
  const resolved = resolveContentPath(sourcePath, target)
  return isLocalAsset(resolved) ? `/media/${resolved}` : target
}

function createMarkdown(sourcePath?: string): MarkdownIt {
  const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true }).use(anchor, { slugify: headingId, permalink: anchor.permalink.ariaHidden({ placement: "after" }) })
  if (sourcePath) {
    const originalLink = markdown.renderer.rules.link_open
    markdown.renderer.rules.link_open = (tokens, index, options, environment, self) => {
      const hrefIndex = tokens[index].attrIndex("href")
      if (hrefIndex >= 0) tokens[index].attrs![hrefIndex][1] = resolveMarkdownLink(sourcePath, tokens[index].attrs![hrefIndex][1])
      return originalLink ? originalLink(tokens, index, options, environment, self) : self.renderToken(tokens, index, options)
    }
    const originalImage = markdown.renderer.rules.image
    markdown.renderer.rules.image = (tokens, index, options, environment, self) => {
      const sourceIndex = tokens[index].attrIndex("src")
      if (sourceIndex >= 0) tokens[index].attrs![sourceIndex][1] = resolveImageSource(sourcePath, tokens[index].attrs![sourceIndex][1])
      return originalImage ? originalImage(tokens, index, options, environment, self) : self.renderToken(tokens, index, options)
    }
  }
  return markdown
}

export function getTableOfContents(body: string): { level: number; text: string; id: string }[] {
  const tokens = createMarkdown().parse(body, {})
  return tokens.flatMap((token, index) => {
    if (token.type !== "heading_open" || !["h2", "h3"].includes(token.tag)) return []
    const text = (tokens[index + 1].children?.filter((child) => ["text", "code_inline"].includes(child.type)).map((child) => child.content).join("") ?? "").trim()
    return [{ level: Number(token.tag.slice(1)), text, id: token.attrGet("id")! }]
  })
}

export function renderMarkdown(body: string, sourcePath: string): string {
  return createMarkdown(sourcePath).render(body)
}
