#!/bin/bash

# Script to add new images to the wishlist based on their filename prefix
# Prefixes: book-, clothes-, toys-, other-
# Images without a recognized prefix are assumed to be "other-"

IMAGES_DIR="images"
BOOKS_FILE="books.txt"
CLOTHES_FILE="clothes.txt"
TOYS_FILE="toys.txt"
OTHER_FILE="other.txt"

# Create data files if they don't exist
touch "$CLOTHES_FILE" "$TOYS_FILE" "$OTHER_FILE"

# Wrap a non-empty value in "..." iff it contains : or , so it parses
# correctly as a single field on the wishlist page. Empty values pass
# through bare so a missing field renders as "::" in the row.
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

# Get all image files from the images directory (excluding .DS_Store)
for image in "$IMAGES_DIR"/*; do
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
