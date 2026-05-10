#!/usr/bin/env python3
"""Extract all existing author information from authors.yaml + author-brief.md files."""

import os, re, yaml, json
from collections import defaultdict

LIBRARY_BASE = '/Users/mulgogi/src/chinese/library'
AUTHORS_YAML = f'{LIBRARY_BASE}/data/authors.yaml'
CONTENT_BASE = f'{LIBRARY_BASE}/content'

def parse_frontmatter(filepath):
    """Parse YAML frontmatter from a markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    fm_match = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
    if not fm_match:
        return None, content
    try:
        fm = yaml.safe_load(fm_match.group(1))
    except:
        return None, content
    return fm, fm_match.group(2).strip()

def content_hash(text):
    """Simple hash for dedup comparison."""
    # Normalize whitespace for comparison
    return re.sub(r'\s+', '', text)

# === Source A: authors.yaml ===
with open(AUTHORS_YAML, 'r', encoding='utf-8') as f:
    authors_data = yaml.safe_load(f)

authors = {}
for ref, data in authors_data.items():
    authors[ref] = {
        'ref': ref,
        'name': data.get('name', ''),
        'dynasty': data.get('dynasty', ''),
        'bio': data.get('bio', ''),  # Some have long bios
        'articles': [],
    }

# === Source B/C/D: author-brief.md files ===
collections = ['primary', 'secondary', 'nss', 'primary-culture']
collection_source_map = {
    'primary': '積累與感興',
    'secondary': '積學與涵泳',
    'nss': 'NSS指定文言經典',
    'primary-culture': '郁文華章',
}

for collection in collections:
    col_path = os.path.join(CONTENT_BASE, collection)
    if not os.path.isdir(col_path):
        continue

    source_name = collection_source_map.get(collection, collection)

    for text_dir in sorted(os.listdir(col_path)):
        dir_path = os.path.join(col_path, text_dir)
        if not os.path.isdir(dir_path):
            continue

        brief_path = os.path.join(dir_path, 'author-brief.md')
        if not os.path.exists(brief_path):
            continue

        fm, body = parse_frontmatter(brief_path)

        # Get ref from frontmatter or from text.cham.md
        ref = None
        if fm and isinstance(fm, dict):
            ref = fm.get('subject', {}).get('ref')

        if not ref:
            # Try to get from text.cham.md frontmatter
            text_cham = os.path.join(dir_path, 'text.cham.md')
            if os.path.exists(text_cham):
                tcfm, _ = parse_frontmatter(text_cham)
                if tcfm and isinstance(tcfm, dict):
                    for contrib in tcfm.get('contributors', []):
                        if isinstance(contrib, dict) and contrib.get('role') == 'author':
                            ref = contrib.get('ref')
                            break

        if not ref or not body.strip():
            continue

        if ref not in authors:
            # New ref from author-brief.md not in authors.yaml
            authors[ref] = {
                'ref': ref,
                'name': '',
                'dynasty': '',
                'bio': '',
                'articles': [],
            }

        article = {
            'source': source_name,
            'type': 'brief',
            'content': body.strip(),
            'used_by': [f'{collection}/{text_dir}'],
        }
        authors[ref]['articles'].append(article)

# === De-duplicate articles within same source ===
for ref, data in authors.items():
    deduped = []
    seen = {}  # (source, content_hash) -> index in deduped

    for article in data['articles']:
        key = (article['source'], content_hash(article['content']))
        if key in seen:
            # Merge used_by
            deduped[seen[key]]['used_by'].extend(article['used_by'])
        else:
            seen[key] = len(deduped)
            deduped.append(article.copy())

    data['articles'] = deduped

# === Report ===
total_articles = sum(len(a['articles']) for a in authors.values())
total_used_by = sum(sum(len(art['used_by']) for art in a['articles']) for a in authors.values())
multi_source = sum(1 for a in authors.values() if len(set(art['source'] for art in a['articles'])) > 1)

print(f"Authors: {len(authors)}")
print(f"Total unique articles (after de-dup): {total_articles}")
print(f"Total used_by references: {total_used_by}")
print(f"Authors with multi-source articles: {multi_source}")
print()

# Show articles per source
source_counts = defaultdict(int)
for a in authors.values():
    for art in a['articles']:
        source_counts[art['source']] += 1
for source, count in sorted(source_counts.items()):
    print(f"  {source}: {count} articles")

# Save output
output = {}
for ref in sorted(authors.keys()):
    output[ref] = authors[ref]

with open('/tmp/existing-authors.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nSaved to /tmp/existing-authors.json")
