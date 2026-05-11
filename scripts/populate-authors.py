#!/usr/bin/env python3
"""Build author library: create directories, author.yaml (YAML-LD), and article files."""

import os, re, json, yaml
from collections import defaultdict

LIBRARY_BASE = '/Users/mulgogi/src/chinese/library'
AUTHORS_DIR = f'{LIBRARY_BASE}/authors'

# Load data sources
with open('/tmp/existing-authors.json', 'r') as f:
    existing = json.load(f)

with open('/tmp/ctext-author-mapping.json', 'r') as f:
    mapping = json.load(f)

with open('/tmp/ctext-persons.json', 'r') as f:
    ctext_persons = json.load(f)

# Build ctext lookup
ctext_by_id = {}
for p in ctext_persons:
    ctext_by_id[p['ctext_id']] = p

# === Step 1: Create context.jsonld ===
os.makedirs(AUTHORS_DIR, exist_ok=True)

context = {
    "@context": {
        "@vocab": "https://library.cham.zone/vocab/",
        "ctext": "https://data.ctext.org/entity/",
        "cprop": "https://data.ctext.org/property/",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "schema": "https://schema.org/",
        "lib": "https://library.cham.zone/vocab/",
        "label": "rdfs:label",
        "ref": "lib:ref",
        "dynasty": "lib:dynasty",
        "alt_names": "lib:altNames",
        "courtesy_name": "lib:courtesyName",
        "bio_sources": "lib:bioSources",
    }
}

with open(f'{AUTHORS_DIR}/context.jsonld', 'w', encoding='utf-8') as f:
    json.dump(context, f, ensure_ascii=False, indent=2)
print("Created context.jsonld")


# === Step 2: Determine entity type ===
def get_entity_type(ref, name):
    """Determine if this is a person, work, or collective."""
    # Works (classic texts)
    works = {'A003', 'A100', 'A146', 'A152', 'A153', 'A169'}
    # Collectives
    collectives = {'A002', 'A007', 'A045', 'A102'}

    if ref in works:
        return 'schema:CreativeWork'
    if ref in collectives:
        return 'lib:CollectiveWork'
    return 'schema:Person'


# === Step 3: Build author directories ===
index = {}  # ref -> directory_name
stats = {'created': 0, 'articles': 0, 'ctext_linked': 0}

for ref in sorted(existing.keys()):
    author = existing[ref]
    name = author['name']
    dynasty = author['dynasty']

    if not name:
        continue

    # Directory name: {ref}_{name}
    # Clean name for directory (remove 《》etc.)
    dir_name = re.sub(r'[《》\s]', '', f'{ref}_{name}')
    dir_path = os.path.join(AUTHORS_DIR, dir_name)
    os.makedirs(dir_path, exist_ok=True)

    index[ref] = dir_name

    # Get ctext data
    match = mapping['matches'].get(ref)
    ctext_data = None
    ctext_id = None
    entity_type = get_entity_type(ref, name)

    if match:
        ctext_id = match['ctext_id']
        ctext_data = ctext_by_id.get(ctext_id)
        stats['ctext_linked'] += 1

    # === Build author.yaml (YAML-LD) ===
    author_yaml = {
        '@context': 'context.jsonld',
    }

    # Identity
    if ctext_id:
        author_yaml['@id'] = f'ctext:{ctext_id}'
    else:
        author_yaml['@id'] = None

    author_yaml['@type'] = entity_type
    author_yaml['ref'] = ref

    # Names
    author_yaml['label'] = name
    if ctext_data:
        alt_names = ctext_data.get('alt_names', [])
        # Filter out names that match our primary name
        alt_names = [n for n in alt_names if n != name]
        if alt_names:
            author_yaml['alt_names'] = alt_names
        if ctext_data.get('name_style'):
            author_yaml['cprop:name-style'] = ctext_data['name_style']

    # Dates
    if ctext_data:
        if ctext_data.get('born'):
            author_yaml['cprop:born'] = {'@value': str(ctext_data['born']), '@type': 'xsd:gYear'}
        if ctext_data.get('died'):
            author_yaml['cprop:died'] = {'@value': str(ctext_data['died']), '@type': 'xsd:gYear'}

    # Dynasty
    author_yaml['dynasty'] = dynasty or None
    if ctext_data and ctext_data.get('dynasty'):
        # Find dynasty ctext ref
        dyn_ref = ctext_data.get('dynasty_ref')
        if dyn_ref:
            author_yaml['cprop:associated-dynasty'] = {'@id': f'ctext:{dyn_ref}'}

    # Authority IDs
    if ctext_data:
        for key in ['wikidata', 'viaf', 'cbdb', 'ddbc']:
            if ctext_data.get(key):
                author_yaml[f'cprop:authority-{key}'] = ctext_data[key]
        if ctext_data.get('wikipedia_zh'):
            author_yaml['cprop:link-wikipedia_zh'] = ctext_data['wikipedia_zh']
        if ctext_data.get('wikipedia_en'):
            author_yaml['cprop:link-wikipedia_en'] = ctext_data['wikipedia_en']

    # Bio sources - handle multiple articles from same source
    from collections import Counter
    source_count = Counter(art['source'] for art in author.get('articles', []))
    source_seq = Counter()  # Track sequence per source

    bio_sources = []
    article_filenames = []
    for article in author.get('articles', []):
        safe_name = re.sub(r'[\\/:*?"<>|]', '', article['source'])
        source_seq[article['source']] += 1
        seq = source_seq[article['source']]

        if source_count[article['source']] > 1:
            filename = f"brief-{safe_name}-{seq}.md"
        else:
            filename = f"brief-{safe_name}.md"

        bio_sources.append({
            'publication': article['source'],
            'file': filename,
        })
        article_filenames.append((article, filename))

    if bio_sources:
        author_yaml['bio_sources'] = bio_sources

    # Also add bio from authors.yaml if present
    if author.get('bio'):
        author_yaml['lib:has_raw_bio'] = True  # Flag that authors.yaml had a bio field

    # Write author.yaml
    yaml_path = os.path.join(dir_path, 'author.yaml')
    with open(yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(author_yaml, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    # === Write article files ===
    for article, filename in article_filenames:
        article_path = os.path.join(dir_path, filename)

        # Build article frontmatter
        fm = {
            'title': '作者簡介',
            'source': {
                'publication': article['source'],
            },
            'type': article['type'],
            'used_by': article['used_by'],
        }

        with open(article_path, 'w', encoding='utf-8') as f:
            f.write('---\n')
            f.write(yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False))
            f.write('---\n\n')
            f.write(article['content'] + '\n')

    stats['articles'] += len(article_filenames)

    stats['created'] += 1

# === Step 4: Write _index.yaml ===
index_data = {
    '_generated': 'scripts/populate-authors.py',
    'total': len(index),
    'authors': index,
}
with open(f'{AUTHORS_DIR}/_index.yaml', 'w', encoding='utf-8') as f:
    yaml.dump(index_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print(f"\nDone!")
print(f"  Directories created: {stats['created']}")
print(f"  Article files: {stats['articles']}")
print(f"  ctext-linked: {stats['ctext_linked']}")
print(f"  Unmatched: {len(mapping['unmatched'])}")
print(f"  Index: {AUTHORS_DIR}/_index.yaml")
