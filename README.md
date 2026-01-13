# Player-Facing Campaign Notes (Public)

This repository contains **player-safe** materials only.

## Nice wiki site (mdBook)

Build the local HTML site:

```bash
./scripts/build_mdbook.sh
```

This generates sources in `.mdbook-src/` and (if `mdbook` is installed) the site in `site/`.

GitHub Pages deployment is handled by `.github/workflows/pages.yml`.

## Build guides

```bash
./scripts/compile_guides.sh
```

If `pandoc` is installed, PDFs will also be generated.

## CI build (GitHub Actions)

A workflow builds the guides on push and uploads `docs/*.md` and `docs/*.pdf` as workflow artifacts.

## Shell compatibility

Scripts are compatible with macOS default bash (3.2).
