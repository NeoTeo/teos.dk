# Wishlist System

A dynamic wishlist page that displays categorized items (books, clothes, toys, and other) with image galleries and detailed information overlays.

## File Structure

```
wishlist/
├── index.html          # Main wishlist page
├── add-images.sh       # Script to add new images to categories
├── books.txt           # Book entries (Author:Title:filename:url:note)
├── clothes.txt         # Clothing entries (Brand:Model:filename:url:note)
├── toys.txt           # Toy entries (Brand:Model:filename:url:note)
├── other.txt          # Other entries (Brand:Model:filename:url:note)
└── images/            # All item images
    ├── book-*.jpg
    ├── clothes-*.jpg
    ├── toys-*.jpg
    └── other-*.jpg
```

## Adding New Items

### 1. Add Image to Directory

Place your image in the `images/` directory with the appropriate prefix:

- `book-filename.jpg` → Books section
- `clothes-filename.jpg` → Clothes section
- `toys-filename.jpg` → Toys section
- `other-filename.jpg` → Other section

**Note:** Images without a recognized prefix will be automatically renamed with `other-` prefix.

### 2. Run the Script

```bash
./add-images.sh
```

This will:
- Scan the `images/` directory for new images
- Add entries to the appropriate .txt file based on prefix
- Skip images already in the data files
- Create placeholder entries that you need to edit

### 3. Edit the Data File

Open the appropriate .txt file and update the placeholder entry:

**For books (books.txt):**
```
Author:Title:filename:url:note
```

Example:
```
Robert D. Richardson:First We Read, Then We Write:book-example.jpg:https://example.com:A guide to reading and writing.
```

**For clothes/toys/other:**
```
Brand:Model:filename:url:note
```

Example:
```
Gran Sasso:Cashmere Sweater:clothes-sweater.jpg:https://example.com:Navy blue crewneck.
```

### 4. Refresh the Page

The page automatically loads from the .txt files - just refresh your browser to see changes.

## Data File Format

Each line in a .txt file follows this format:

```
Field1:Field2:filename:url:note
```

- **Field1:** Author (books) or Brand (clothes/toys/other)
- **Field2:** Title (books) or Model (clothes/toys/other)
- **filename:** Image filename (must exist in `images/` directory)
- **url:** Optional URL to product/store (leave empty with `::` if none)
- **note:** Optional description shown in detail overlay

**Example with URL:**
```
Kenya Hara:Designing Design:book-design.jpg:https://example.com/book:Design philosophy from Muji.
```

**Example without URL:**
```
Kenya Hara:Designing Design:book-design.jpg::Design philosophy from Muji.
```

## Hiding Items

To temporarily hide an item without deleting it, add `//` at the start of the line:

```
Robert D. Richardson:First We Read, Then We Write:book-example.jpg::Active item
//Kenya Hara:Designing Design:book-design.jpg::Hidden item
```

The hidden item won't appear on the page but remains in the file for future reactivation.

## Special Characters

If your text contains colons (`:`), escape them with a backslash:

```
Author Name:Title\: Subtitle:book-example.jpg::Note text here.
```

## Multi-line Notes

The Brian Eno book example shows multi-line notes are supported - the parser handles line breaks within the note field.

## Running a Local Server

**Important:** Serve the site from the parent directory (`teos.dk`), not from the `wishlist` directory, so the relative paths to stylesheets and fonts work correctly:

```bash
cd /Users/teo/source/web/teos.dk
python3 -m http.server 8000
# Then visit: http://localhost:8000/wishlist/
```

## Display Features

- **Masonry Layout:** Items arranged in a responsive grid (3 columns → 2 → 1 based on screen size)
- **Hover Tooltips:** Show brand/author and model/title on hover
- **Click Overlays:** Detailed view with notes and store links
- **Responsive Design:** Adapts to mobile, tablet, and desktop screens

## Troubleshooting

**Images not appearing:**
- Check that the filename in the .txt file exactly matches the file in `images/`
- Verify the image file extension is correct
- Look for typos in the filename

**Font not loading:**
- Ensure you're serving from the parent directory, not from `wishlist/`
- Check that `../stylesheets/teostyle.css` is accessible

**Layout issues:**
- Refresh the page to recalculate masonry layout
- Resize the browser window to trigger layout recalculation
- Check browser console for JavaScript errors
