# Blog Post Generator

A Python script that converts markdown files into styled HTML blog posts and automatically updates your blog index pages.

## Requirements

- Python 3
- `markdown` library

Install dependencies:
```bash
pip install markdown
```

## Markdown File Format

Your markdown file must follow this structure:

```markdown
# Post Title
17/10/2025
Your post content goes here in markdown format.

You can use **bold**, *italic*, links, etc.
```

- **Line 1**: Title (with optional `#` heading marker)
- **Line 2**: Date (any format you prefer)
- **Line 3+**: Post content in markdown

## Usage

```bash
  source venv/bin/activate

  python3 generate_post.py path/to/your-post.md

when done:
  deactivate	
```

## What It Does

When you run the script, it:

1. **Generates an HTML file** with the same name as your markdown file
   - Applies consistent styling (700px width, iA Writer Quattro font)
   - Includes title, date, and your converted content
   - Adds a home button footer

2. **Updates `wroteindex.html`**
   - Adds a dated link to your new post at the top
   - Skips if the post already exists in the index

3. **Updates `../index.html`**
   - Updates the "Recently wrote >" section with your latest post
   - Replaces the previous "Recently wrote" entry

## Example

```bash
python generate_post.py "my-new-post.md"
```

Output:
```
→ Generated my-new-post.html and updated wroteindex.html
```

This creates `my-new-post.html` and updates both index files automatically.
