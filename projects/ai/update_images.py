#!/usr/bin/env python3
"""
Updates aiprojs.html with images from the images/ directory.
Images are grouped by project prefix and sorted by their numeric sequence.

Naming conventions:
- prefix_N.ext or prefix_N_suffix.ext (e.g., arss_1.png, arss_2_semantic.png)
- prefix_N.M_suffix.ext for decimals (e.g., arss_1.1_title.png, arss_1.2_feature.png)
- prefixNNNNN.ext (e.g., ulysquot00001.png)
"""

import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / 'images'
HTML_FILE = SCRIPT_DIR / 'aiprojs.html'

PROJECTS = ['arss', 'neggo', 'timelines', 'ulysquot']
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}


def get_sort_key(filename: str, prefix: str) -> tuple:
    """Extract a sort key from filename for ordering within a project."""
    # Try prefix_N or prefix_N.M pattern (arss_1.png, arss_1.1_title.png)
    match = re.match(rf'^{re.escape(prefix)}_(\d+(?:\.\d+)?)', filename)
    if match:
        return (0, float(match.group(1)), filename)

    # Try prefixNNNNN pattern (ulysquot00001.png)
    match = re.match(rf'^{re.escape(prefix)}(\d+)', filename)
    if match:
        return (0, float(match.group(1)), filename)

    # Handle ulysquotC* (comes after ulysquot*)
    if prefix == 'ulysquot' and filename.startswith('ulysquotC'):
        match = re.match(r'^ulysquotC(\d+)', filename)
        if match:
            return (1, float(match.group(1)), filename)

    return (2, 0, filename)


def find_project_images() -> dict[str, list[str]]:
    """Find all images for each project, sorted by sequence number."""
    result = {}

    for project in PROJECTS:
        images = []
        for f in IMAGES_DIR.iterdir():
            if f.suffix.lower() in IMAGE_EXTENSIONS and f.name.startswith(project):
                images.append(f.name)

        images.sort(key=lambda x: get_sort_key(x, project))

        if images:
            result[project] = images

    return result


def generate_project_images_js(project_images: dict[str, list[str]]) -> str:
    """Generate the projectImages JavaScript object."""
    lines = ['const projectImages = {']

    items = list(project_images.items())
    for i, (project, images) in enumerate(items):
        image_list = ',\n\t\t\t\t'.join(f"'images/{img}'" for img in images)
        comma = ',' if i < len(items) - 1 else ''
        lines.append(f"\t\t\t'{project}': [\n\t\t\t\t{image_list}\n\t\t\t]{comma}")

    lines.append('\t\t};')
    return '\n'.join(lines)


def update_html(project_images: dict[str, list[str]]) -> None:
    """Update the HTML file with new image data."""
    html = HTML_FILE.read_text()

    # Update projectImages object
    js_object = generate_project_images_js(project_images)
    pattern = r'const projectImages = \{[\s\S]*?\n\t\t\};'
    html = re.sub(pattern, js_object, html)

    # Update each project's thumbnail and image count
    for project, images in project_images.items():
        first_image = f'images/{images[0]}'
        count = len(images)

        # Update thumbnail src
        pattern = rf"(onclick=\"openLightbox\('{project}', 0\)\">\s*<img src=\")[^\"]*(\"|')"
        html = re.sub(pattern, rf'\g<1>{first_image}\2', html)

        # Update image count badge
        # Find the project-image div and update/add/remove the count div
        if count > 1:
            # Update existing count or add one
            project_div_pattern = rf"(onclick=\"openLightbox\('{project}', 0\)\">\s*<img[^>]*>)\s*(?:<div class=\"image-count\">\d+</div>)?"
            replacement = rf'\1\n\t\t\t<div class="image-count">{count}</div>'
            html = re.sub(project_div_pattern, replacement, html)
        else:
            # Remove count div if exists
            project_div_pattern = rf"(onclick=\"openLightbox\('{project}', 0\)\">\s*<img[^>]*>)\s*<div class=\"image-count\">\d+</div>"
            html = re.sub(project_div_pattern, r'\1', html)

    HTML_FILE.write_text(html)
    print(f"Updated {HTML_FILE}")
    for project, images in project_images.items():
        print(f"  {project}: {len(images)} images")


if __name__ == '__main__':
    project_images = find_project_images()
    update_html(project_images)
