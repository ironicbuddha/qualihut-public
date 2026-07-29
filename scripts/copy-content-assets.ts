import { cpSync, existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const destination = resolve(process.cwd(), "public/media")
if (existsSync(destination)) rmSync(destination, { recursive: true })
cpSync(resolve(process.cwd(), "content"), destination, {
  recursive: true,
  filter: (source) => !source.endsWith(".md") && !source.includes("/.obsidian"),
})
