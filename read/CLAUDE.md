# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal reading tracker website for teos.dk/read. The repository contains:

- **HTML pages**: Static reading list pages displaying books by year
- **JavaScript automation**: Script to update reading progress from markdown data
- **Reading progress data**: Markdown file containing current reading progress

## Core Files

- `readindex.html` - Main reading list page with current year and in-progress books
- `read2022.html` - Historical reading list for 2022
- `readingprogress.md` - Data file containing reading progress (author, title, progress level 1-10)
- `update-reading-progress.js` - Node.js script that syncs progress from MD to HTML

## Reading Progress System

The system tracks books currently being read with a 10-point progress indicator shown as visual progress bars (`I*---------I` to `I---------*I`).

### Data Format
The `readingprogress.md` file uses comma-separated format:
```
Author Name, Book Title, CurrentPageofTotalPages
```

Example: `Robert Bringhurst, The Elements of Typographic Style, 25of351`

The script automatically converts page progress to a 1-10 scale for display (0-10% = 1, 11-20% = 2, etc.).

### Update Process
Run the update script to sync changes from markdown to HTML:
```bash
node update-reading-progress.js
```

The script:
- Parses the markdown file for reading progress entries
- Updates existing entries with new progress values
- Adds new entries to the "in progress" section
- Preserves the HTML structure and styling
- Manages metadata (ISBN-10 and page count) on book entries

### Book Metadata

Books in the HTML have data attributes for programmatic access:

- `data-isbn10`: ISBN-10 identifier for the book (may be empty for books without ISBNs). Hyphens are automatically stripped to normalize the format.
- `data-pagecount`: Total page count from the markdown file (source of truth)

**Looking up book information:**
Book data can be retrieved using the Open Library API with ISBN-10:
- API endpoint: `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn10}&format=json&jscmd=data`
- Example: `https://openlibrary.org/api/books?bibkeys=ISBN:0415138574&format=json&jscmd=data`
- Documentation: https://openlibrary.org/dev/docs/api/books

When books are completed and moved to the year section, their metadata is preserved in `<span>` tags.

### User Interface Features

**Page Count Tooltips:**
When hovering over any book entry (in progress or completed) that has a `data-pagecount` attribute, a tooltip displays the total page count (e.g., "525 pages") to the left of the book entry.

**Year Statistics Tooltips:**
When hovering over a year header (e.g., "2025", "2024"), a tooltip displays:
- Total number of books read that year
- Total pages read (if any books have page count data)
- Example: "8 books, 2,847 pages"

Implementation:
- CSS tooltip styling in the `<style>` section
- JavaScript positions book page count tooltips to the left of entries
- Year statistics calculated by counting text nodes + `<br>`, `<span>`, and `<div>` elements with metadata
- Help cursor indicates interactive elements
- Page counts formatted with comma separators for readability

## Architecture Notes

- **Static Site**: No build process required, pure HTML/CSS/JS
- **Data Separation**: Reading data maintained in markdown, synced to HTML for display
- **Manual Process**: Updates require running the sync script manually
- **CSS Integration**: Uses shared stylesheets from parent directory (`../stylesheets/teostyle.css`)

## Development Workflow

1. Update reading progress in `readingprogress.md`
2. Run `node update-reading-progress.js` to sync changes
3. Commit both the markdown and HTML files

Progress values range from 1-10, where 1 represents early progress and 10 represents near completion.