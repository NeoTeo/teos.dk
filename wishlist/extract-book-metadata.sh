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
# Diagnostics are written to stderr. A malformed/failed claude response is
# retried up to MAX_ATTEMPTS times (with a visible notice) before giving up,
# since such responses are often transient even for a readable image.

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

# Claude's response can occasionally be a transient non-answer (a refusal or
# "blocker" sentence instead of the requested format) even when the image is
# perfectly readable. Retry a few times before giving up so one flaky reply
# doesn't poison the wishlist with an Unknown placeholder.
MAX_ATTEMPTS=3

# Announce retries so a caller (and the human watching it) can tell the script
# is working through attempts, not hung. We always write to stderr (captured to
# the log when add-images.sh redirects it). When stderr is NOT the terminal, we
# *also* write to the controlling terminal so the message is visible live; the
# open is guarded so it's a no-op under cron/CI with no tty.
notify() {
    printf '%s\n' "$*" >&2
    if [ ! -t 2 ] && { true >/dev/tty; } 2>/dev/null; then
        printf '%s\n' "$*" >/dev/tty
    fi
}

# Validate raw response: exactly three lines, in order, each starting with the
# right key and a valid OK|MISSING marker. On success, prints the normalized
# three lines to stdout and returns 0. On failure, writes a diagnostic to
# stderr and returns 1 (so the caller can retry rather than abort).
validate_response() {
    local raw=$1
    local -a expected_keys=(AUTHOR TITLE BLURB)
    local line_count=0 output="" line key
    while IFS= read -r line; do
        if [ "$line_count" -ge 3 ]; then
            echo "extract-book-metadata: response has more than 3 lines" >&2
            return 1
        fi
        key=${expected_keys[$line_count]}
        case "$line" in
            "$key:OK:"*|"$key:MISSING:"*) ;;
            *)
                echo "extract-book-metadata: malformed line ${line_count} (expected $key:<OK|MISSING>:...): $line" >&2
                return 1
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
        return 1
    fi

    printf '%s\n' "$output"
}

# Create the scratch dir INSIDE the current directory. Claude Code's headless
# (-p) sandbox only grants access to its working directory, so a converted image
# placed in $TMPDIR (/var/folders/...) can't be read — it must live under $PWD.
workdir=$(mktemp -d "$PWD/.bookmeta.XXXXXX")
claude_err="$workdir/claude.stderr"
trap 'rm -rf "$workdir"' EXIT

# Claude's vision input accepts JPEG/PNG/GIF/WebP but NOT formats like AVIF or
# HEIC. Handed an unsupported format, claude can't see the cover at all — in
# headless `-p` mode it can't even self-convert (that needs an interactive
# permission grant) — so it returns a "blocker" sentence instead of metadata.
# Transcode such images to a temporary PNG ourselves and feed claude that. The
# temp lives under our workdir with a space-free name and is cleaned up on exit.
ext_lower=$(printf '%s' "${image_path##*.}" | tr '[:upper:]' '[:lower:]')
case "$ext_lower" in
    jpg|jpeg|png|gif|webp)
        claude_image=$image_path
        ;;
    *)
        claude_image="$workdir/cover.png"
        if ! command -v sips >/dev/null 2>&1; then
            echo "extract-book-metadata: .$ext_lower is not a Claude-viewable image format and 'sips' is unavailable to convert it" >&2
            exit 1
        fi
        if ! sips -s format png -Z 1568 "$image_path" --out "$claude_image" >/dev/null 2>&1; then
            echo "extract-book-metadata: failed to convert $image_path (.$ext_lower) to a viewable PNG" >&2
            exit 1
        fi
        ;;
esac

# Send the prompt with an @-mention of the (viewable) image. Claude Code reads
# the file referenced by @<path> and includes it as image input. Capture
# claude's stderr so we can surface it on failure.
img_label=$(basename "$image_path")
attempt=1
while :; do
    claude_ok=1
    raw=$(claude -p "${PROMPT} @${claude_image}" 2>"$claude_err") || claude_ok=0

    if [ "$claude_ok" -eq 1 ]; then
        # validate_response prints the normalized lines on success; capture them
        # so we only emit to stdout once we know the response is well-formed.
        if result=$(validate_response "$raw"); then
            printf '%s\n' "$result"
            exit 0
        fi
        fail_reason="malformed response"
    else
        {
            echo "extract-book-metadata: claude invocation failed"
            if [ -s "$claude_err" ]; then
                echo "  claude stderr:"
                sed 's/^/    /' "$claude_err"
            fi
        } >&2
        fail_reason="claude invocation failed"
    fi

    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        notify "extract-book-metadata: giving up on ${img_label} after ${attempt} attempt(s) (${fail_reason})"
        exit 1
    fi

    notify "extract-book-metadata: ${img_label} — attempt ${attempt}/${MAX_ATTEMPTS} failed (${fail_reason}); retrying..."
    attempt=$((attempt + 1))
done
