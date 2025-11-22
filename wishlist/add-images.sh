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

# Get all image files from the images directory (excluding .DS_Store)
for image in "$IMAGES_DIR"/*; do
    # Skip if not a file or is .DS_Store
    [ ! -f "$image" ] && continue
    filename=$(basename "$image")
    [ "$filename" = ".DS_Store" ] && continue

    # Determine the category based on prefix
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
        # No recognized prefix, assume "other"
        category="other"
        target_file="$OTHER_FILE"
        # Rename the file to have other- prefix if it doesn't have any recognized prefix
        if [[ ! "$filename" == other-* ]]; then
            new_filename="other-$filename"
            mv "$image" "$IMAGES_DIR/$new_filename"
            filename="$new_filename"
            echo "Renamed $image to $IMAGES_DIR/$new_filename"
        fi
    fi

    # Check if this image is already in the target file
    if grep -q ":$filename:" "$target_file" 2>/dev/null; then
        echo "Skipping $filename - already in $target_file"
        continue
    fi

    # Add the image to the appropriate file with a placeholder format
    # Format for books: Author:Title:filename:url:note
    # Format for others: Brand:Model:filename:url:note
    if [ "$category" = "book" ]; then
        echo "Unknown:Unknown Title:$filename::" >> "$target_file"
        echo "Added $filename to $target_file (category: $category)"
        echo "  → Please edit $target_file to add proper author, title, URL, and notes"
    else
        echo "Unknown Brand:Unknown Model:$filename::" >> "$target_file"
        echo "Added $filename to $target_file (category: $category)"
        echo "  → Please edit $target_file to add proper brand, model, URL, and notes"
    fi
done

echo ""
echo "Done! Please review and update the data files with proper information."
