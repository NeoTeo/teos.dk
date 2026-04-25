# Book Cover Metadata Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `wishlist/add-images.sh` so that for every new `book-*` image it auto-fills author, title, and a one-sentence blurb in `books.txt` (with feedback when any field is unextractable), via a new `wishlist/extract-book-metadata.sh` helper that calls the local `claude` CLI.

**Architecture:** Two scripts with a narrow line-oriented contract. `extract-book-metadata.sh` takes one image path, shells out to the `claude` CLI in non-interactive mode (`claude -p "<prompt> @<image_path>"`), and prints exactly three lines (`AUTHOR:<OK|MISSING>:<value>`, `TITLE:...`, `BLURB:...`). `add-images.sh` parses those lines, applies a "quote-when-needed" rule, and assembles a `books.txt` row, falling back to the existing `Unknown` placeholder if the extractor exits non-zero. Behavior for non-book categories is unchanged.

**Tech Stack:** Bash 3.2+ (macOS default) and the local `claude` CLI (v2.1.119+). No new dependencies. Verification is manual, per the spec — no test framework added.

**Spec:** `docs/superpowers/specs/2026-04-25-book-cover-metadata-extraction-design.md`

**Verified before planning:** `claude -p "<prompt> @<image_path>"` accepts `@filepath` mentions for image input in non-interactive mode and returns text on stdout (confirmed against `wishlist/images/book-marxcapital.jpg`).

---

## File Structure

**Created:**
- `wishlist/extract-book-metadata.sh` — the new extractor helper.

**Modified:**
- `wishlist/add-images.sh` — book branch only; everything else untouched.
- `wishlist/README.md` — document the new behavior, the helper script, and `extract.log`.

**Out of scope (no changes this iteration):**
- `wishlist/index.html` parser. (Re-read during Task 4 to confirm new quoted rows render correctly. Only adjust if a real failure surfaces during end-to-end verification.)

---

## Task 1: Implement `extract-book-metadata.sh`

Build the helper, then smoke-test it on real covers.

**Files:**
- Create: `wishlist/extract-book-metadata.sh`

- [ ] **Step 1: Write `wishlist/extract-book-metadata.sh`**

```bash
#!/usr/bin/env bash
# extract-book-metadata.sh <image_path>
#
# Invokes the local `claude` CLI with the cover image and a fixed prompt,
# then validates that the response is exactly three lines of the form
#   AUTHOR:<OK|MISSING>:<value>
#   TITLE:<OK|MISSING>:<value>
#   BLURB:<OK|MISSING>:<value>
# and prints them to stdout.
#
# Exit code 0 means the extractor ran end-to-end (MISSING markers are data,
# not errors). Any non-zero exit code means the extractor could not run at
# all (claude not found, image unreadable, malformed response, etc.).
# Diagnostics are written to stderr.

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "usage: $0 <image_path>" >&2
    exit 64
fi

image_path=$1
if [ ! -f "$image_path" ]; then
    echo "extract-book-metadata: image not found: $image_path" >&2
    exit 66
fi

if ! command -v claude >/dev/null 2>&1; then
    echo "extract-book-metadata: claude CLI not found on PATH" >&2
    exit 127
fi

PROMPT='You are extracting metadata from a book cover image. Output EXACTLY three lines in this format, with no preamble, commentary, or markdown:

AUTHOR:<OK|MISSING>:<value>
TITLE:<OK|MISSING>:<value>
BLURB:<OK|MISSING>:<value>

Rules:
- AUTHOR: the author'\''s name as it appears on the cover. If unreadable, output AUTHOR:MISSING:
- TITLE: the title as it appears on the cover. Include the subtitle if visible. If unreadable, output TITLE:MISSING:
- BLURB: one sentence describing the book (<=25 words). First, use any blurb visible on the cover. Otherwise, write one from your own knowledge of this book, identified via the author/title you just read. If you cannot identify the book, output BLURB:MISSING:
- Never guess. When in doubt, mark MISSING.
- Values must be on one line. No quotes, no newlines, no leading or trailing whitespace.'

# Send the prompt with an @-mention of the image. Claude Code reads the
# file referenced by @<path> and includes it as image input.
raw=$(claude -p "${PROMPT} @${image_path}" 2>/dev/null) || {
    echo "extract-book-metadata: claude invocation failed" >&2
    exit 1
}

# Validate: exactly three lines, in order, each starting with the right
# key and a valid OK|MISSING marker.
expected_keys=(AUTHOR TITLE BLURB)
line_count=0
output=""
while IFS= read -r line; do
    if [ "$line_count" -ge 3 ]; then
        echo "extract-book-metadata: response has more than 3 lines" >&2
        exit 1
    fi
    key=${expected_keys[$line_count]}
    case "$line" in
        "$key:OK:"*|"$key:MISSING:"*) ;;
        *)
            echo "extract-book-metadata: malformed line ${line_count} (expected $key:<OK|MISSING>:...): $line" >&2
            exit 1
            ;;
    esac
    if [ -n "$output" ]; then
        output+=$'\n'
    fi
    output+=$line
    line_count=$((line_count + 1))
done <<< "$raw"

if [ "$line_count" -ne 3 ]; then
    echo "extract-book-metadata: expected 3 lines, got $line_count" >&2
    exit 1
fi

printf '%s\n' "$output"
```

- [ ] **Step 2: Mark it executable**

```bash
chmod +x wishlist/extract-book-metadata.sh
```

- [ ] **Step 3: Smoke-test on a known cover**

Run:
```bash
wishlist/extract-book-metadata.sh wishlist/images/book-marxcapital.jpg
```
Expected: three well-formed lines on stdout, exit 0.
- `AUTHOR:OK:Karl Marx` (or `AUTHOR:OK:Karl Marx (translated by Paul Reitter)` — either is fine).
- `TITLE:OK:Capital` (subtitle may be included).
- `BLURB:OK:<one sentence>`.

If the response is malformed (script exits non-zero with a stderr diagnostic), tighten the prompt wording and re-run until it complies. Save any prompt tweaks before moving on.

- [ ] **Step 4: Smoke-test on the new untracked cover**

Run:
```bash
wishlist/extract-book-metadata.sh wishlist/images/book-shatnerboldlygo.jpg
```
Expected: three well-formed lines on stdout, exit 0, sensible values for William Shatner / *Boldly Go*.

- [ ] **Step 5: Smoke-test the failure path (claude missing)**

Run:
```bash
PATH="" wishlist/extract-book-metadata.sh wishlist/images/book-marxcapital.jpg; echo "exit=$?"
```
Expected: stderr diagnostic `claude CLI not found on PATH`, `exit=127`.

Run:
```bash
wishlist/extract-book-metadata.sh /no/such/file.jpg; echo "exit=$?"
```
Expected: stderr diagnostic `image not found: /no/such/file.jpg`, `exit=66`.

- [ ] **Step 6: Commit**

```bash
git add wishlist/extract-book-metadata.sh
git commit -m "Add extract-book-metadata.sh helper for book cover OCR via claude CLI"
```

---

## Task 2: Update the `add-images.sh` orchestrator

Replace the book-branch handling so it calls the extractor, parses the three-line response, applies the quoting rule, and prints a per-image summary. Falls back to the existing `Unknown` placeholder when the extractor exits non-zero.

**Files:**
- Modify: `wishlist/add-images.sh` — replace everything from `# Skip if not a file or is .DS_Store` through the end of file. The header (shebang, top comment, var assignments, the `touch` line) and the `for image in "$IMAGES_DIR"/*; do` line stay unchanged.

- [ ] **Step 1: Replace the body of the loop**

Open `wishlist/add-images.sh`. Locate the `for image in "$IMAGES_DIR"/*; do` line. Replace everything from the next line through the end of the file with this block:

```bash
    # Skip if not a file or is .DS_Store
    [ ! -f "$image" ] && continue
    filename=$(basename "$image")
    [ "$filename" = ".DS_Store" ] && continue

    # Determine the category based on prefix.
    category=""
    target_file=""

    if [[ "$filename" == book-* ]]; then
        category="book"
        target_file="$BOOKS_FILE"
    elif [[ "$filename" == clothes-* ]]; then
        category="clothes"
        target_file="$CLOTHES_FILE"
    elif [[ "$filename" == toys-* ]]; then
        category="toys"
        target_file="$TOYS_FILE"
    else
        # No recognized prefix, assume "other".
        category="other"
        target_file="$OTHER_FILE"
        if [[ ! "$filename" == other-* ]]; then
            new_filename="other-$filename"
            mv "$image" "$IMAGES_DIR/$new_filename"
            filename="$new_filename"
            echo "Renamed $image to $IMAGES_DIR/$new_filename"
        fi
    fi

    # Skip if this image is already in the target file.
    if grep -q ":$filename:" "$target_file" 2>/dev/null; then
        echo "Skipping $filename - already in $target_file"
        continue
    fi

    if [ "$category" = "book" ]; then
        if extractor_out=$(./extract-book-metadata.sh "$image" 2>>extract.log); then
            # Parse the three lines into AUTHOR / TITLE / BLURB values + statuses.
            author_raw=""; title_raw=""; blurb_raw=""
            a_status="ok"; t_status="ok"; b_status="ok"
            while IFS= read -r line; do
                case "$line" in
                    "AUTHOR:OK:"*)      author_raw=${line#AUTHOR:OK:} ;;
                    "AUTHOR:MISSING:"*) a_status="NOT EXTRACTED" ;;
                    "TITLE:OK:"*)       title_raw=${line#TITLE:OK:} ;;
                    "TITLE:MISSING:"*)  t_status="NOT EXTRACTED" ;;
                    "BLURB:OK:"*)       blurb_raw=${line#BLURB:OK:} ;;
                    "BLURB:MISSING:"*)  b_status="NOT EXTRACTED" ;;
                esac
            done <<< "$extractor_out"

            # Apply placeholders for MISSING fields.
            [ "$a_status" = "ok" ] || author_raw="Unknown"
            [ "$t_status" = "ok" ] || title_raw="Unknown Title"
            # blurb stays empty when MISSING.

            # Quoting rule: wrap a non-empty value in "..." iff it contains : or ,
            quote_field() {
                local v=$1
                if [ -z "$v" ]; then
                    printf ''
                elif [[ "$v" == *:* || "$v" == *,* ]]; then
                    printf '"%s"' "$v"
                else
                    printf '%s' "$v"
                fi
            }
            author_field=$(quote_field "$author_raw")
            title_field=$(quote_field "$title_raw")
            blurb_field=$(quote_field "$blurb_raw")

            echo "${author_field}:${title_field}:${filename}::${blurb_field}" >> "$target_file"
            echo "$filename: author=${a_status}, title=${t_status}, blurb=${b_status}"
        else
            echo "Unknown:Unknown Title:${filename}::" >> "$target_file"
            echo "$filename: extraction failed (see extract.log) — wrote placeholder"
        fi
    else
        echo "Unknown Brand:Unknown Model:$filename::" >> "$target_file"
        echo "Added $filename to $target_file (category: $category)"
        echo "  → Please edit $target_file to add proper brand, model, URL, and notes"
    fi
done

echo ""
echo "Done! Please review and update the data files with proper information."
```

- [ ] **Step 2: Smoke-test the orchestrator on the new image**

Confirm `book-shatnerboldlygo.jpg` is the only un-recorded book image (the orchestrator skips any filename already in `books.txt`). From inside `wishlist/`:
```bash
cd wishlist
./add-images.sh
```
Expected:
- One row appended to `books.txt` for `book-shatnerboldlygo.jpg`.
- A summary line `book-shatnerboldlygo.jpg: author=ok, title=ok, blurb=ok` (or with `NOT EXTRACTED` markers if the model couldn't read a field).
- No spurious changes to clothes / toys / other rows.
- If anything went to stderr (model hiccup, etc.), it lands in `wishlist/extract.log`.

- [ ] **Step 3: Inspect the new row**

Run: `tail -1 books.txt`
Expected: a line of the form `<author>:<title>:book-shatnerboldlygo.jpg::<blurb>` with quoted fields (`"..."`) only where the value contains `:` or `,`.

If the row looks wrong, fix the orchestrator (or prompt) and re-run. To force re-processing, manually delete the row from `books.txt` first.

- [ ] **Step 4: Commit**

```bash
git add wishlist/add-images.sh
git commit -m "Wire add-images.sh book branch to extract-book-metadata.sh"
```

---

## Task 3: Update the README

Document the new behavior so the next person (or future-you) understands what's happening.

**Files:**
- Modify: `wishlist/README.md`

- [ ] **Step 1: Update "Adding New Items" → step 3**

Find the existing section that begins:
```
### 3. Edit the Data File

Open the appropriate .txt file and update the placeholder entry:
```

Replace it with:
```
### 3. Edit the Data File

Open the appropriate .txt file and update the placeholder entry.

For book images, the script will have already attempted to fill in
author, title, and blurb using the local `claude` CLI. Check the
per-image summary printed by the script — any field marked
`NOT EXTRACTED` (or the whole row marked `extraction failed`) needs
manual fix-up. URL is always left empty by the auto-extractor.

For clothes / toys / other images, the row is always a placeholder
that needs manual editing.
```

- [ ] **Step 2: Add a new "Book Metadata Extraction" subsection above "Hiding Items"**

Insert this subsection (the four-backtick outer fence keeps the inner triple-backtick example intact when copied into the README):

````
## Book Metadata Extraction

When a `book-*` image is added, `add-images.sh` calls
`extract-book-metadata.sh` to populate author, title, and a one-sentence
blurb automatically.

Requirements:
- The `claude` CLI must be on `PATH`.

Per-image output:
- `book-foo.jpg: author=ok, title=ok, blurb=ok` — all three fields filled.
- `book-foo.jpg: author=ok, title=ok, blurb=NOT EXTRACTED` — the marked
  field needs manual fix-up. The row is still written with sensible
  placeholders (`Unknown` / `Unknown Title` / empty blurb).
- `book-foo.jpg: extraction failed (see extract.log) — wrote placeholder` —
  the extractor could not run at all (e.g., `claude` not on `PATH`,
  network failure, malformed model response). The full
  `Unknown:Unknown Title:filename::` placeholder is written. Stderr from
  the failed call is appended to `wishlist/extract.log`.

Run the extractor manually on a single image to test:

```
./extract-book-metadata.sh images/book-shatnerboldlygo.jpg
```

It prints exactly three lines (AUTHOR / TITLE / BLURB) and exits 0 on
success.
````

- [ ] **Step 3: Commit**

```bash
git add wishlist/README.md
git commit -m "Document book metadata extraction in wishlist README"
```

---

## Task 4: End-to-end verification (spec's verification plan)

Walk the spec's verification plan against the integrated system. Commit any prompt or parser tweaks that come out of it.

**Files:**
- Possibly modify: `wishlist/extract-book-metadata.sh` (prompt tightening only, if needed)
- Possibly modify: `wishlist/index.html` (only if the parser doesn't accept the new quoted rows — flagged in the spec, this is the agreed direction)

- [ ] **Step 1: Extractor in isolation on the new untracked image**

Run:
```bash
wishlist/extract-book-metadata.sh wishlist/images/book-shatnerboldlygo.jpg
```
Expected: three `AUTHOR:`/`TITLE:`/`BLURB:` lines on stdout, exit 0, sensible values for William Shatner / *Boldly Go*.

- [ ] **Step 2: Extractor on a known cover**

Run:
```bash
wishlist/extract-book-metadata.sh wishlist/images/book-marxcapital.jpg
```
Expected: `AUTHOR:OK:Karl Marx` (or translated edition), `TITLE:OK:Capital`, a one-sentence blurb. Exit 0.

- [ ] **Step 3: Orchestrator integration**

Already exercised in Task 2 step 2, but verify the row in `books.txt` is well-formed:
```bash
tail -1 wishlist/books.txt
```
Expected: a properly-quoted row for `book-shatnerboldlygo.jpg`.

- [ ] **Step 4: End-to-end render in the browser**

Serve the site from the parent directory and view the wishlist:
```bash
cd /Users/teo/source/web/teos.dk
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
open http://localhost:8000/wishlist/
```
Confirm the new `book-shatnerboldlygo.jpg` entry renders correctly (image visible, author and title in the hover tooltip, blurb in the click overlay). Check 1-2 other book entries to confirm no regression.

Stop the server: `kill "$SERVER_PID"`.

If the new quoted row doesn't render correctly, that's a parser issue. Adjust `wishlist/index.html` so it accepts pure-quoting form (the agreed direction; no need to keep `\:` working for new rows).

- [ ] **Step 5: Failure-path smoke test**

Drop a second book cover into `wishlist/images/` (or temporarily remove the `book-shatnerboldlygo.jpg` row from `books.txt` to force re-processing), then run the orchestrator with `claude` shadowed off `PATH`:
```bash
cd wishlist
EMPTY_DIR="$(mktemp -d)"
PATH="$EMPTY_DIR" ./add-images.sh
rmdir "$EMPTY_DIR"
```
Expected:
- The orchestrator writes `Unknown:Unknown Title:<filename>::` for the affected book image(s).
- Console prints `<filename>: extraction failed (see extract.log) — wrote placeholder`.
- `wishlist/extract.log` contains a `claude CLI not found on PATH` diagnostic.

If the failure-path test left a placeholder row in `books.txt` you didn't want, remove it manually before continuing.

- [ ] **Step 6: Commit any verification-driven tweaks (only if anything changed)**

If Steps 1-5 surfaced prompt or parser tweaks, commit them now:
```bash
git add wishlist/extract-book-metadata.sh wishlist/index.html  # whichever applies
git commit -m "Tune prompt / parser based on end-to-end verification"
```
If nothing changed, skip the commit.

- [ ] **Step 7: Final state check**

Run:
```bash
git status
```
Expected: working tree clean (apart from the untracked `wishlist/images/book-shatnerboldlygo.jpg` itself, and `wishlist/extract.log` if it accumulated diagnostics — neither is part of this feature's deliverable, both are user-managed).

---

## Done criteria

- `wishlist/extract-book-metadata.sh` exists, is executable, and produces well-formed three-line output for the existing book covers (real `claude` CLI invocation works).
- `wishlist/add-images.sh` book branch writes properly-quoted rows, prints per-image summaries, and falls back to `Unknown:Unknown Title:...::` on extractor failure.
- `wishlist/README.md` documents the new behavior.
- `wishlist/extract.log` is the documented home for stderr diagnostics from failed extractor calls.
- `book-shatnerboldlygo.jpg` is added to `books.txt` and renders in the wishlist page (the user can decide separately when to commit the image and the row).
- Behavior for clothes / toys / other images is unchanged.

## Follow-ups (out of scope)

- Task #9 from the brainstorming task list: collapse `books.txt` escaping to "quoting only" — migrate existing `\:` rows and update the parser if needed.
- Optional `--backfill` flag to re-process existing `Unknown:Unknown Title:...` rows.
