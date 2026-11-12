#!/usr/bin/env python3
"""Land the operator's three-scaffold drop (2026-09-30) verbatim.

Source: upload/Pasted Content_1790713562952.txt (the operator's drop,
preserved unmodified). This extractor writes every fenced file block
whose section heading names a path under src/ive/, src/hbk/, or
src/proofbridge/ — byte-faithful, no manual transcription.

Sections 1.1/2.1/3.1 (Directory trees), 1.26/2.17/3.17 (Build checks),
and I.1/I.3 (patches to Part B files that were never dropped on this
box) are intentionally NOT written — those gaps are named in the
worklog, not fabricated.

Fail-closed: any nested fence or missing block aborts the run.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project")
SRC = ROOT / "upload" / "Pasted Content_1790713562952.txt"

HEADING = re.compile(r"^(\d+\.\d+)\s+(.+)$")

def main() -> int:
    text = SRC.read_text(encoding="utf-8")
    lines = text.split("\n")

    sections: list[tuple[str, str, int]] = []  # (num, raw_title, line_idx)
    in_fence = False
    for i, line in enumerate(lines):
        if in_fence:
            if line.strip() == "```":
                in_fence = False
            continue
        if line.startswith("```"):
            in_fence = True
            continue
        m = HEADING.match(line)
        if m:
            sections.append((m.group(1), m.group(2).strip(), i))

    written: list[tuple[str, int, int]] = []  # (path, lines, bytes)
    for num, title, idx in sections:
        path = title.split(" — ")[0].strip()
        if not path.startswith("src/"):
            continue  # Directory / Build check / prose sections
        # find the fence that holds this file's content
        j = idx + 1
        while j < len(lines) and not lines[j].startswith("```"):
            if lines[j].strip() == "":
                j += 1
                continue
            # non-blank prose before the fence — not a file section
            j = len(lines)
            break
        if j >= len(lines):
            print(f"ABORT: no fence found for {num} {path}", file=sys.stderr)
            return 1
        j += 1  # first content line
        content: list[str] = []
        closed = False
        while j < len(lines):
            if lines[j].strip() == "```":
                closed = True
                break
            content.append(lines[j])
            j += 1
        if not closed:
            print(f"ABORT: unterminated fence for {num} {path}", file=sys.stderr)
            return 1
        body = "\n".join(content) + "\n"
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            print(f"ABORT: refusing to overwrite existing {path}", file=sys.stderr)
            return 1
        target.write_text(body, encoding="utf-8")
        written.append((path, len(content), len(body.encode("utf-8"))))

    if len(written) != 54:
        print(f"ABORT: expected 54 files, wrote {len(written)}", file=sys.stderr)
        return 1

    print(f"OK: {len(written)} files landed")
    for path, n, b in written:
        print(f"  {path}  ({n} lines, {b} bytes)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
