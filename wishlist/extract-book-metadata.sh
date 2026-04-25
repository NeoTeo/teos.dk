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
