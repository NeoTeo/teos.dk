#!/usr/bin/env python3
"""
Updates aiprojs.html with images from the images/ directory and
project descriptions from projdesc.md.

Images are grouped by project prefix and sorted by their numeric sequence.

Naming conventions:
- prefix_N.ext or prefix_N_suffix.ext (e.g., arss_1.png, arss_2_semantic.png)
- prefix_N.M_suffix.ext for decimals (e.g., arss_1.1_title.png, arss_1.2_feature.png)
- prefixNNNNN.ext (e.g., ulysquot00001.png)

projdesc.md format:
# projectname
Description text (can span multiple lines, may contain HTML like <a> tags).
"""

import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / 'images'
HTML_FILE = SCRIPT_DIR / 'aiprojs.html'
PROJDESC_FILE = SCRIPT_DIR / 'projdesc.md'

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}


def parse_projdesc() -> dict[str, str]:
    """Parse projdesc.md and return a dict of project name -> description."""
    content = PROJDESC_FILE.read_text()
    projects = {}

    # Split by headings
    parts = re.split(r'^# (\w+)\s*$', content, flags=re.MULTILINE)

    # parts[0] is before the first heading (empty or whitespace)
    # then alternating: name, description, name, description, ...
    for i in range(1, len(parts), 2):
        name = parts[i].strip()
        desc = parts[i + 1].strip() if i + 1 < len(parts) else ''
        # Join lines into a single paragraph, preserving HTML
        desc = ' '.join(line.strip() for line in desc.split('\n') if line.strip())
        projects[name] = desc

    return projects


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


def find_project_images(projects: list[str]) -> dict[str, list[str]]:
    """Find all images for each project, sorted by sequence number."""
    result = {}

    for project in projects:
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


def generate_project_html(project: str, description: str, images: list[str] | None) -> str:
    """Generate HTML block for a single project."""
    lines = [f'\t<!-- {project.capitalize()} Project -->']
    lines.append('\t<div class="project">')

    if images:
        first_image = f'images/{images[0]}'
        count = len(images)
        lines.append(f'\t\t<div class="project-image" onclick="openLightbox(\'{project}\', 0)">')
        lines.append(f'\t\t\t<img src="{first_image}" alt="{project.capitalize()}">')
        if count > 1:
            lines.append(f'\t\t\t<div class="image-count">{count}</div>')
        lines.append('\t\t</div>')
    else:
        # No images yet - show placeholder
        lines.append('\t\t<div class="project-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center;">')
        lines.append('\t\t\t<span style="color: #999;">No images</span>')
        lines.append('\t\t</div>')

    lines.append('\t\t<div class="project-content">')
    lines.append(f'\t\t\t<h2>{project}</h2>')
    lines.append(f'\t\t\t<p>')
    lines.append(f'\t\t\t{description}')
    lines.append(f'\t\t\t</p>')
    lines.append('\t\t</div>')
    lines.append('\t</div>')
    lines.append('')

    return '\n'.join(lines)


def generate_all_projects_html(project_descs: dict[str, str], project_images: dict[str, list[str]]) -> str:
    """Generate HTML for all projects."""
    blocks = []
    for project, description in project_descs.items():
        images = project_images.get(project)
        blocks.append(generate_project_html(project, description, images))
    return '\n'.join(blocks)


def update_html(project_descs: dict[str, str], project_images: dict[str, list[str]]) -> None:
    """Update the HTML file with project entries and image data."""
    html = HTML_FILE.read_text()

    # Replace all project blocks (between <hr> and <!-- Lightbox Modal -->)
    projects_html = generate_all_projects_html(project_descs, project_images)
    pattern = r'(<hr>\n\n)[\s\S]*?(<!-- Lightbox Modal -->)'
    html = re.sub(pattern, rf'\1{projects_html}\t\2', html)

    # Update projectImages object
    js_object = generate_project_images_js(project_images)
    pattern = r'const projectImages = \{[\s\S]*?\n\t\t\};'
    html = re.sub(pattern, js_object, html)

    HTML_FILE.write_text(html)
    print(f"Updated {HTML_FILE}")
    for project in project_descs:
        images = project_images.get(project, [])
        print(f"  {project}: {len(images)} images")


if __name__ == '__main__':
    project_descs = parse_projdesc()
    project_images = find_project_images(list(project_descs.keys()))
    update_html(project_descs, project_images)
