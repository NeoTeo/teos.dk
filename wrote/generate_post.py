#!/usr/bin/env python3

#script by ChatGPT o4-mini-high
import sys
import os
import re
import markdown

def slugify(fname):
    return os.path.splitext(os.path.basename(fname))[0] + '.html'

def parse_md(path):
    with open(path, encoding='utf-8') as f:
        lines = [l.rstrip('\n') for l in f]
    if len(lines) < 3:
        sys.exit("Markdown file needs at least 3 lines (title, date, body).")
    title    = re.sub(r'^#+\s*', '', lines[0]).strip()
    date     = lines[1].strip()
    body_md  = '\n'.join(lines[2:]).strip()
    return title, date, body_md

def render_html(title, date, body_html):
    return f"""<!DOCTYPE html>
<html>

    <head>
        <title>{title}</title>
        <link href="../stylesheets/teostyle.css" rel="stylesheet" type="text/css" media="all">
        <style>
            body {{
                margin: 90px auto 50px;
                width: 700px;
                font-family: 'iA Writer Quattro S', serif !important;
                font-size: 16px;
                line-height: 1.4;
            }}
            .right {{ float: right; }}
        </style>
    </head>
    <meta charset="utf-8">
    <body>
    <b>{title}</b><div class="right">{date}</div>
    <hr>
    {body_html}
    </body>

</html>
"""

def update_index(index_path, link_href, link_text, date):
    # read existing index
    with open(index_path, encoding='utf-8') as f:
        lines = f.readlines()

    # don't add if this link is already present
    if any(f'href="{link_href}"' in l for l in lines):
        return

    # build a date-stamped entry
    entry = (
        f'<span class="entry-date">{date}</span> '
        f'<a href="{link_href}">{link_text}</a><br>\n'
    )

    out = []
    inserted = False
    for line in lines:
        out.append(line)
        # immediately after the opening <p>, insert our new entry
        if not inserted and line.strip() == '<p>':
            out.append(entry)
            inserted = True

    if not inserted:
        sys.exit("Could not find <p> in index to insert link.")

    with open(index_path, 'w', encoding='utf-8') as f:
        f.writelines(out)

def main():
    if len(sys.argv) != 2:
        print("Usage: python generate_post.py path/to/post.md")
        sys.exit(1)

    md_path = sys.argv[1]
    title, date, body_md = parse_md(md_path)
    html_fname = slugify(md_path)

    # write the new post
    body_html = markdown.markdown(body_md)
    with open(html_fname, 'w', encoding='utf-8') as f:
        f.write(render_html(title, date, body_html))

    # update index, passing in the post's date
    index_path = 'wroteindex.html'
    update_index(index_path, html_fname, title, date)

    print(f"→ Generated {html_fname} and updated {index_path}")

if __name__ == '__main__':
    main()

