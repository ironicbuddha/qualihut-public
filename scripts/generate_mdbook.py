#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fnmatch
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _strip_frontmatter(md: str) -> tuple[str, str]:
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", md, re.S)
    if not m:
        return "", md
    return m.group(1), m.group(2)


def _extract_title(frontmatter: str, body: str, fallback: str) -> str:
    m_title = re.search(r"^title:\s*(.+)\s*$", frontmatter, re.M)
    if m_title:
        return m_title.group(1).strip()
    m_h1 = re.search(r"^#\s+(.+)$", body, re.M)
    if m_h1:
        return m_h1.group(1).strip()
    return fallback


def _strip_first_h1(body: str) -> str:
    return re.sub(r"^#\s+.*\n", "", body, count=1).strip()


def _expand_include(root: Path, spec: str) -> list[Path]:
    p = root / spec
    if p.is_dir():
        return sorted(p.rglob("*.md"))
    if any(ch in spec for ch in ["*", "?", "["]):
        return sorted(root.glob(spec))
    if p.is_file():
        return [p]
    return []


@dataclass(frozen=True)
class Manifest:
    title: str
    includes: list[str]
    excludes: list[str]


def _parse_manifest(path: Path) -> Manifest:
    title = path.stem
    includes: list[str] = []
    excludes: list[str] = []
    for raw in _read_text(path).splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("TITLE="):
            title = line.split("=", 1)[1].strip()
            continue
        if line.startswith("INCLUDE="):
            includes.append(line.split("=", 1)[1].strip())
            continue
        if line.startswith("EXCLUDE="):
            excludes.append(line.split("=", 1)[1].strip())
            continue
    return Manifest(title=title, includes=includes, excludes=excludes)


def _is_excluded(root: Path, file_path: Path, patterns: list[str]) -> bool:
    rel = file_path.relative_to(root).as_posix()
    return any(fnmatch.fnmatch(rel, pat) for pat in patterns)


def _humanize_section(section: str) -> str:
    if section == "meta":
        return "Meta"
    if section == "_world_state.md":
        return "World State"
    return section.replace("-", " ").replace("_", " ").title()


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate an mdBook source tree from a manifest.")
    ap.add_argument("--root", required=True, help="Repo root directory.")
    ap.add_argument("--manifest", required=True, help="Path to a .manifest file.")
    ap.add_argument("--out-src", required=True, help="Output directory for mdBook sources.")
    ap.add_argument("--title", required=True, help="Book title.")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest).resolve()
    out_src = Path(args.out_src).resolve()

    manifest = _parse_manifest(manifest_path)

    src_dir = out_src / "src"
    if out_src.exists():
        shutil.rmtree(out_src)
    src_dir.mkdir(parents=True, exist_ok=True)

    book_toml = "\n".join(
        [
            "[book]",
            f'title = "{args.title}"',
            "authors = []",
            "language = \"en\"",
            "",
            "[output.html]",
            "default-theme = \"navy\"",
            "",
        ]
    )
    _write_text(out_src / "book.toml", book_toml)

    files: list[Path] = []
    for inc in manifest.includes:
        files.extend(_expand_include(root, inc))

    # Deduplicate + sort
    uniq: dict[str, Path] = {}
    for f in files:
        uniq[f.resolve().as_posix()] = f
    files = sorted(uniq.values(), key=lambda p: p.as_posix())

    filtered = [f for f in files if not _is_excluded(root, f, manifest.excludes)]

    # Generate pages mirroring their repo-relative paths.
    pages: list[tuple[str, str]] = []
    for f in filtered:
        rel = f.relative_to(root).as_posix()
        dest = src_dir / rel

        raw = _read_text(f)
        front, body = _strip_frontmatter(raw)
        title = _extract_title(front, body, fallback=f.stem)
        body = _strip_first_h1(body)

        page = "\n".join(
            [
                f"# {title}",
                "",
                f"_Source: `{rel}`_",
                "",
                body,
                "",
            ]
        ).rstrip() + "\n"

        _write_text(dest, page)
        pages.append((rel, title))

    # Index page
    _write_text(
        src_dir / "index.md",
        "\n".join(
            [
                f"# {args.title}",
                "",
                "This site is generated from the player-safe content repo.",
                "",
                "Use the left navigation to browse sections.",
                "",
            ]
        ),
    )

    # Group by section (content/<section>/...)
    by_section: dict[str, list[tuple[str, str]]] = {}
    for rel, title in pages:
        parts = rel.split("/")
        section = "Misc"
        if len(parts) >= 2 and parts[0] == "content":
            section = parts[1]
        by_section.setdefault(section, []).append((rel, title))

    # Create section landing pages and SUMMARY
    summary_lines: list[str] = ["# Summary", "", "- [Home](index.md)"]
    sections_dir = src_dir / "sections"

    for section in sorted(by_section.keys()):
        section_title = _humanize_section(section)
        section_page = f"sections/{section}.md"
        summary_lines.append(f"- [{section_title}]({section_page})")

        section_items = sorted(by_section[section], key=lambda t: t[1].lower())
        for rel, title in section_items:
            summary_lines.append(f"  - [{title}]({rel})")

        section_md = "\n".join(
            [f"# {section_title}", "", "## Pages", ""]
            + [f"- [{title}](../{rel})" for rel, title in section_items]
            + [""]
        )
        _write_text(sections_dir / f"{section}.md", section_md)

    _write_text(src_dir / "SUMMARY.md", "\n".join(summary_lines).rstrip() + "\n")

    print(f"Wrote mdBook sources: {out_src}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

