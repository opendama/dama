#!/usr/bin/env python3
"""Build DOCX downloads from docs/guides/*.md (no em dashes)."""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_LINE_SPACING
from docx.shared import Pt

ROOT = Path(__file__).resolve().parents[1]
GUIDES = ROOT / "docs" / "guides"
DOWNLOADS = GUIDES / "downloads"


def no_em(s: str) -> str:
    return (
        s.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def md_to_blocks(md: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    lines = no_em(md).replace("\r\n", "\n").split("\n")
    para: list[str] = []
    table_buf: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            blocks.append(("p", " ".join(para).strip()))
            para = []

    def flush_table() -> None:
        nonlocal table_buf
        if table_buf:
            blocks.append(("table", "\n".join(table_buf)))
            table_buf = []

    for line in lines:
        raw = line.rstrip()
        if not raw.strip():
            flush_para()
            flush_table()
            continue
        if raw.lstrip().startswith("|"):
            flush_para()
            table_buf.append(raw)
            continue
        flush_table()
        if raw.startswith("# "):
            flush_para()
            blocks.append(("h1", raw[2:].strip()))
        elif raw.startswith("## "):
            flush_para()
            blocks.append(("h2", raw[3:].strip()))
        elif raw.startswith("### "):
            flush_para()
            blocks.append(("h3", raw[4:].strip()))
        elif raw.startswith("#### "):
            flush_para()
            blocks.append(("h4", raw[5:].strip()))
        elif raw.startswith("- "):
            flush_para()
            blocks.append(("li", raw[2:].strip()))
        elif re.match(r"^\d+\.\s+", raw):
            flush_para()
            blocks.append(("li", re.sub(r"^\d+\.\s+", "", raw).strip()))
        else:
            para.append(raw.strip())
    flush_para()
    flush_table()
    return blocks


def write_docx(md_path: Path) -> Path:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    body = md_path.read_text(encoding="utf-8")
    assert "\u2014" not in body, md_path.name
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    for kind, text in md_to_blocks(body):
        if kind == "h1":
            doc.add_heading(text, level=1)
        elif kind == "h2":
            doc.add_heading(text, level=2)
        elif kind == "h3":
            doc.add_heading(text, level=3)
        elif kind == "h4":
            doc.add_heading(text, level=4)
        elif kind == "li":
            doc.add_paragraph(text, style="List Bullet")
        elif kind == "table":
            rows = [r for r in text.split("\n") if r.strip().startswith("|")]
            parsed: list[list[str]] = []
            for r in rows:
                cells = [c.strip() for c in r.strip().strip("|").split("|")]
                if all(set(c) <= set("-: ") for c in cells):
                    continue
                parsed.append(cells)
            if not parsed:
                continue
            cols = max(len(r) for r in parsed)
            table = doc.add_table(rows=len(parsed), cols=cols)
            table.style = "Table Grid"
            for ri, row in enumerate(parsed):
                for ci in range(cols):
                    table.rows[ri].cells[ci].text = row[ci] if ci < len(row) else ""
            doc.add_paragraph("")
        else:
            doc.add_paragraph(text)

    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    out = DOWNLOADS / (md_path.stem + ".docx")
    refresh = DOWNLOADS / (md_path.stem + "_refresh.docx")
    try:
        doc.save(out)
        # Keep refresh twin in sync for readers when primary is locked elsewhere.
        doc.save(refresh)
        return out
    except PermissionError:
        doc.save(refresh)
        print(f"locked {out.name}; wrote {refresh.name}")
        return refresh


def main() -> None:
    files = sorted(GUIDES.glob("Dama_*.md"))
    if not files:
        raise SystemExit("no Dama_*.md guides found")
    for md in files:
        md.write_text(no_em(md.read_text(encoding="utf-8")), encoding="utf-8")
        # Always sync downloads/*.md from guides/*.md
        (DOWNLOADS / md.name).write_text(md.read_text(encoding="utf-8"), encoding="utf-8")
        docx = write_docx(md)
        print(md.name, "->", docx.name, f"({docx.stat().st_size} bytes)")
    readme = GUIDES / "README.md"
    if readme.exists():
        readme.write_text(no_em(readme.read_text(encoding="utf-8")), encoding="utf-8")
    print("done", len(files), "guides")


if __name__ == "__main__":
    main()
