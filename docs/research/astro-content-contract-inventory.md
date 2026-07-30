# Astro content contract inventory

## Scope

This inventory answers [Inventory the existing content contract and Quartz behavior for Astro](https://github.com/ironicbuddha/qualihut-public/issues/7). It is based on the repository's tracked source and generated Quartz output, not a proposed Astro implementation.

## Content contract

- `content/` is the GM-published, player-safe source of truth. It contains 232 Markdown records, 116 raster images, and five other files at the time of inspection. The migration must keep this directory and its authoring workflow intact.
- Every Markdown record has YAML frontmatter with exactly `id`, `title`, and `type`; no current record adds dates, tags, descriptions, aliases, or draft state. `id` is a stable machine key, `title` is the visible heading, and `type` is one of 18 current values (including `person`, `institution`, `location`, `meta`, `session-recap`, `spell`, and `quest`). Source: an inventory of `content/**/*.md`; representative records are [`content/index.md`](../../content/index.md), [`content/locations/banco-valdieri-bankhouse.md`](../../content/locations/banco-valdieri-bankhouse.md), and [`content/people/pcs/Warren/bianca-montelupo.md`](../../content/people/pcs/Warren/bianca-montelupo.md).
- The source is hierarchical, including nested paths such as `people/pcs/<player>/` and `magic/spells/`. Astro routes must retain a deterministic page for every Markdown source; human-visible linking must work across sibling, parent, and nested directories.
- 125 source files contain relative Markdown links. They use paths such as `institutions/broadbarrel-caravan.md`, `../institutions/banco-valdieri.md`, and `meta/session-summaries/...md`. Astro must resolve those links to rendered pages while preserving anchors when present; authors must not need to rewrite content.
- 117 source files embed images using relative Markdown image syntax. Images are colocated in section `images/` directories and, for player-character material, beside the Markdown record. Astro must copy/serve these source-relative assets and rewrite rendered `src` values correctly. The prior Quartz fix explicitly addressed relative-media resolution in commit `a893d5a`.
- The Markdown needed by the public site includes headings, paragraphs, emphasis, lists, block quotes, fenced code, tables, and inline/relative links. `content/index.md` is unusually large and uses several reference tables; its table rendering and long-page anchors are required, not edge cases.

## Campaign Index requirements

`content/index.md` has `id: player-home`, `title: "Campaign Index"`, and `type: meta`. It is the public root and is not an automatically generated directory index. It contains the Current Campaign Context, visible freshness statement, Key people, Key places, Open Threads and Leads, recent recaps, start links, and broad player-safe reference tables. Astro must render this authored order and content directly; it must not replace it with an inferred catalogue landing page.

The Current Campaign Context and Open Threads and Leads are author-maintained Markdown sections. Updating them after a session is therefore a content-only publication operation, which preserves the GM-to-public workflow.

## Existing Quartz behaviour to preserve or deliberately retire

The build command is `npm run repo:build` in `quartz-4`, which runs Quartz against `../content` (`quartz-4/package.json`). The GitHub Pages workflow builds that same source and publishes `quartz-4/public` (`.github/workflows/deploy-quartz-pages.yml`).

Quartz currently provides all of the following:

- one content page per record, folder and tag pages, aliases, a sitemap, RSS, static-asset copying, and a 404 page (`quartz-4/quartz.config.ts`);
- rendered relative links, heading anchors, table formatting, frontmatter-derived title and modified-date/read-time metadata, plus syntax highlighting and Math/LaTex support (same configuration);
- a desktop/mobile Explorer, search, dark mode, reader mode, graph/global graph, breadcrumbs, table of contents, and backlinks (`quartz-4/quartz.layout.ts`; generated `quartz-4/public/index.html`).

The map explicitly makes Astro the sole production renderer and excludes player search and legacy URL compatibility. Therefore Astro must preserve content pages, relative links, image rendering, authored Campaign Index layout, headings/TOC-quality navigation, and a useful 404; it does not need to carry forward Quartz search, graph/backlinks, RSS, sitemap, tag/folder pages, reader mode, dark mode, or the existing GitHub Pages URL shape unless a later ticket deliberately includes them.

## Migration-ready conclusion

Astro should treat `content/` as an unchanged file-based corpus: validate the existing three-field frontmatter, load every Markdown file recursively, derive routes from source paths with the special root mapping for `content/index.md`, transform relative `.md` links and source-relative image URLs, and render standard GFM Markdown including tables. The next architecture and visual tickets can choose implementation details without changing authoring paths, frontmatter, or the GM-to-public publication boundary.

## Sources

- [`content/`](../../content/) and its representative records cited above.
- [`content/index.md`](../../content/index.md) for the authored Campaign Index and its Current Campaign Context / Open Threads and Leads structure.
- [`quartz-4/package.json`](../../quartz-4/package.json), [`quartz-4/quartz.config.ts`](../../quartz-4/quartz.config.ts), and [`quartz-4/quartz.layout.ts`](../../quartz-4/quartz.layout.ts) for the active renderer and configured behavior.
- [GitHub Pages deployment workflow](../../.github/workflows/deploy-quartz-pages.yml) and the generated [`quartz-4/public/index.html`](../../quartz-4/public/index.html) for the present publishing and rendered-site behavior.
