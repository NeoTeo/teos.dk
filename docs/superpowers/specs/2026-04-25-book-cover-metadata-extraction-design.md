# Book cover metadata extraction — design

**Date:** 2026-04-25
**Scope:** `wishlist/add-images.sh` and a new helper script `wishlist/extract-book-metadata.sh`.

## Problem

`wishlist/add-images.sh` scans `wishlist/images/` for new images, categorizes each by filename prefix, and appends a placeholder row to the appropriate data file. For book images (prefix `book-`), the placeholder is `Unknown:Unknown Title:filename::`, which the user must edit manually to provide author, title, URL, and a description.

The new feature uses the book cover image to populate author, title, and a one-sentence blurb automatically when the script runs. When any field cannot be extracted, the script reports it to the user.

## Goals

- For each *new* `book-*` image, extract author and title from the cover and produce a one-sentence blurb for the description.
- When a field is unextractable, write a sensible placeholder for that field and tell the user which fields need manual fix-up.
- Don't change behavior for clothes / toys / other images.
- Don't disrupt the script's existing batch-friendly, non-interactive flow.

## Non-goals

- Back-filling existing `Unknown` rows in `books.txt` (out of scope; current run only touches new images, matching today's behavior).
- Populating the URL field — it stays empty (`::`).
- Migrating existing `\:` colon-escaping in `books.txt` to pure quoting (captured as task #9, separate effort).
- Online lookups (Open Library, Google Books, etc.). Extraction is local-only via the `claude` CLI.

## Architecture

Two scripts in `wishlist/`:

- **`add-images.sh`** *(modified)* — orchestrator. Behavior for non-book categories is unchanged. For new `book-*` images, it shells out to the helper, parses its output, builds a properly-quoted row for `books.txt`, and prints a per-image summary line.
- **`extract-book-metadata.sh`** *(new)* — book-cover extractor. Takes one image path, invokes the local `claude` CLI in non-interactive mode with the image attached, parses the model response, and prints three fixed-format lines.

The two scripts communicate over a narrow line-oriented contract. The orchestrator never calls `claude` directly. The extractor never touches `books.txt`. Both can be exercised independently.

## Extractor contract

Invocation:

```
./extract-book-metadata.sh <image_path>
```

Stdout (always exactly three lines, in this order):

```
AUTHOR:<OK|MISSING>:<value>
TITLE:<OK|MISSING>:<value>
BLURB:<OK|MISSING>:<value>
```

When the marker is `MISSING`, `<value>` is empty. When `OK`, `<value>` is plain text — no internal quoting, no escaping, no leading/trailing whitespace, no embedded newlines or quote characters. The orchestrator is responsible for any quoting needed when assembling the `books.txt` row.

Exit codes:

- `0` — extractor ran end-to-end. `MISSING` markers are *data*, not error.
- non-zero — extractor could not run at all. Causes: `claude` CLI not on `PATH`, image unreadable, model returned unparseable output, network failure, etc.

Stderr: human-readable diagnostic messages. The orchestrator appends stderr to `wishlist/extract.log` for later inspection.

## Prompt to the model

The extractor sends the image and a single fixed prompt to `claude` in non-interactive mode:

```
You are extracting metadata from a book cover image. Output EXACTLY three
lines in this format, with no preamble, commentary, or markdown:

AUTHOR:<OK|MISSING>:<value>
TITLE:<OK|MISSING>:<value>
BLURB:<OK|MISSING>:<value>

Rules:
- AUTHOR: the author's name as it appears on the cover. If unreadable,
  output AUTHOR:MISSING:
- TITLE: the title as it appears on the cover. Include the subtitle if
  visible. If unreadable, output TITLE:MISSING:
- BLURB: one sentence describing the book (≤25 words).
  · First, use any blurb visible on the cover.
  · Otherwise, write one from your own knowledge of this book, identified
    via the author/title you just read.
  · If you cannot identify the book, output BLURB:MISSING:
- Never guess. When in doubt, mark MISSING.
- Values must be on one line. No quotes, no newlines, no leading or
  trailing whitespace.
```

The prompt forbids the model from emitting characters that would break `books.txt` parsing (`:`, `"`, newlines), so values can be assembled into rows without further sanitisation beyond the orchestrator's quoting rule below.

The exact `claude` CLI flag/syntax for attaching an image is an implementation detail to be confirmed by experiment when implementing the extractor — the design only commits to "non-interactive `claude` invocation with the cover image as input."

**Robustness.** The extractor validates that the response is exactly three lines, in order, each starting with `AUTHOR:`, `TITLE:`, `BLURB:` and a valid `<OK|MISSING>` marker. On any deviation, the extractor exits non-zero with a stderr diagnostic.

## Orchestrator changes

The book branch of `add-images.sh` becomes:

```bash
if [ "$category" = "book" ]; then
    if extractor_out=$(./extract-book-metadata.sh "$image" 2>>extract.log); then
        # Parse the three lines. For each field, capture both the value
        # (defaulting to "Unknown" / "Unknown Title" / empty when MISSING)
        # and a status flag (ok / NOT EXTRACTED).
        # Apply the quoting rule below to each non-empty value.
        row="${author_field}:${title_field}:${filename}::${blurb_field}"
        echo "$row" >> "$BOOKS_FILE"
        echo "$filename: author=${a_status}, title=${t_status}, blurb=${b_status}"
    else
        echo "Unknown:Unknown Title:${filename}::" >> "$BOOKS_FILE"
        echo "$filename: extraction failed (see extract.log) — wrote placeholder"
    fi
fi
```

Behavior for non-book categories is unchanged.

## Row assembly and quoting rule

New rows written by this feature follow the agreed direction (task #9): quoting is the *only* escape mechanism. For each non-empty field assembled into a `books.txt` row:

- If the value contains `:` or `,`, wrap it in `"..."`.
- Otherwise emit it bare.

Because the prompt forbids the model from emitting `:` or `"` characters, values are safe to drop in directly. The implementer should briefly re-read the parser (`wishlist/index.html`) before merging to confirm new quoted rows render correctly. If the parser doesn't already accept this form for *all* fields (it currently does for some), the parser gets adjusted — task #9 is the agreed direction.

The URL field stays empty (`::`), matching the user's stated scope (author/title/blurb only).

## Per-image summary format

Console output, one line per processed `book-*` image:

```
book-shatnerboldlygo.jpg: author=ok, title=ok, blurb=ok
book-foo.jpg: author=ok, title=ok, blurb=NOT EXTRACTED
book-bar.jpg: extraction failed (see extract.log) — wrote placeholder
```

The "NOT EXTRACTED" wording maps to a `MISSING` marker from the extractor. The "extraction failed" wording maps to a non-zero exit code from the extractor.

## Error handling

| Situation                         | Extractor behavior                  | Orchestrator behavior                                                  |
|-----------------------------------|-------------------------------------|------------------------------------------------------------------------|
| `claude` CLI not on `PATH`        | exit non-zero, stderr diagnostic    | write `Unknown:Unknown Title:filename::`, log failure in summary       |
| Network / API call failure         | exit non-zero, stderr diagnostic    | same                                                                   |
| Model returned malformed output    | exit non-zero, stderr diagnostic    | same                                                                   |
| Field marked `MISSING`             | exit 0, line `<FIELD>:MISSING:`     | use placeholder for that field, mark `NOT EXTRACTED` in summary        |
| All three fields `OK`              | exit 0, three populated `:OK:` lines| write the populated row, all three fields `=ok` in summary             |

Stderr from the extractor is appended to `wishlist/extract.log` (per the user's global rule: keep debug logs in the project directory).

## Verification plan

Done means all five of these have been done and produced expected results:

1. **Extractor in isolation** on the existing untracked image:
   ```
   ./extract-book-metadata.sh images/book-shatnerboldlygo.jpg
   ```
   Expect three `AUTHOR:`/`TITLE:`/`BLURB:` lines on stdout, exit 0, sensible values for William Shatner / *Boldly Go*.
2. **Extractor edge cases** — run against an existing well-known cover (e.g. `book-marxcapital.jpg`) and a stylized cover where some field is plausibly unreadable. Confirm `OK` and `MISSING` paths each produce well-formed output.
3. **Orchestrator integration** — drop a fresh `book-*` image into `images/`, run `./add-images.sh`, confirm a quoted row was appended to `books.txt` and the per-image summary printed.
4. **End-to-end render** — refresh the wishlist page in the browser and confirm the new entry renders correctly (image, author, title, blurb in the overlay).
5. **Failure path** — temporarily shadow `claude` on `PATH` (or pass an unreadable file) and confirm the orchestrator writes the `Unknown:Unknown Title:...::` placeholder and logs the failure to `extract.log` and the summary.

## Follow-ups (out of scope here)

- Task #9: collapse `books.txt` escaping to "quoting only" — migrate existing `\:` rows and update the parser if needed.
- Optional `--backfill` flag to re-process existing `Unknown:Unknown Title:...` rows (rejected for this iteration).
