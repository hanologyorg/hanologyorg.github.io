#!/usr/bin/env python3
"""Enrich author.yaml files with additional data from ctext reference library.

For each author with a ctext @id, looks up the reference data and adds
any missing properties. Never overwrites existing data.
"""

import yaml
import os
import copy

AUTHORS_DIR = '/Users/mulgogi/src/chinese/library/authors'
REFERENCE_DIR = '/Users/mulgogi/src/chinese/library/reference'


def load_reference_persons():
    """Load all person reference data into a dict keyed by ctext_id."""
    index_path = os.path.join(REFERENCE_DIR, 'person', '_index.yaml')
    if not os.path.exists(index_path):
        return {}

    with open(index_path, 'r') as f:
        person_index = yaml.safe_load(f)['index']

    ref_data = {}
    for shard_file in set(person_index.values()):
        path = os.path.join(REFERENCE_DIR, 'person', shard_file)
        with open(path, 'r') as f:
            for doc in yaml.safe_load_all(f):
                if doc and '@id' in doc:
                    ctext_id = doc['@id'].replace('ctext:', '')
                    ref_data[ctext_id] = doc

    return ref_data


def load_dynasty_index():
    """Load dynasty data for resolving dynasty references."""
    path = os.path.join(REFERENCE_DIR, 'dynasty.yaml')
    if not os.path.exists(path):
        return {}

    dynasties = {}
    with open(path, 'r') as f:
        for doc in yaml.safe_load_all(f):
            if doc and '@id' in doc:
                ctext_id = doc['@id'].replace('ctext:', '')
                dynasties[ctext_id] = doc
    return dynasties


def enrich_author(author, ref, dynasties):
    """Add missing properties from reference data to author. Returns list of additions."""
    additions = []

    # Property mapping: reference key → author.yaml key
    # Simple properties (string values)
    simple_props = {
        'name-art': 'cprop:name-art',
        'name-posthumous': 'cprop:name-posthumous',
        'name-temple': 'cprop:name-temple',
        'born-date': 'cprop:born-date',
        'died-date': 'cprop:died-date',
        'died-age': 'cprop:died-age',
        'sinica': 'cprop:authority-sinica',
    }

    for ref_key, author_key in simple_props.items():
        if ref_key in ref and ref[ref_key] and author_key not in author:
            author[author_key] = ref[ref_key]
            additions.append(ref_key)

    # Entity references (ctext:XXXXX)
    ref_props = {
        'father': 'cprop:father',
        'place': 'cprop:place',
    }

    for ref_key, author_key in ref_props.items():
        if ref_key in ref and ref[ref_key] and author_key not in author:
            val = ref[ref_key]
            if isinstance(val, dict) and '@id' in val:
                author[author_key] = {'@id': val['@id']}
            else:
                author[author_key] = val
            additions.append(ref_key)

    # List properties
    if 'held-office' in ref and ref['held-office'] and 'cprop:held-office' not in author:
        author['cprop:held-office'] = ref['held-office']
        additions.append('held-office')

    if 'exam-status' in ref and ref['exam-status'] and 'cprop:exam-status' not in author:
        author['cprop:exam-status'] = ref['exam-status']
        additions.append('exam-status')

    # Dynasty: if author doesn't have cprop:associated-dynasty but ref does
    if 'dynasty' in ref and ref['dynasty'] and 'cprop:associated-dynasty' not in author:
        val = ref['dynasty']
        if isinstance(val, dict) and '@id' in val:
            author['cprop:associated-dynasty'] = {'@id': val['@id']}
            additions.append('associated-dynasty')

    # Alt names from reference
    if 'names' in ref and ref['names']:
        existing_alt = author.get('alt_names', [])
        existing_all = {author.get('label', '')} | set(existing_alt)
        new_names = [n for n in ref['names'] if n not in existing_all]
        if new_names:
            if 'alt_names' not in author:
                author['alt_names'] = existing_alt + new_names
            else:
                author['alt_names'] = existing_alt + new_names
            additions.append(f'alt_names +{len(new_names)}')

    return additions


def main():
    print("Loading reference data...")
    ref_persons = load_reference_persons()
    dynasties = load_dynasty_index()
    print(f"  {len(ref_persons)} persons, {len(dynasties)} dynasties")

    # Load author index
    with open(os.path.join(AUTHORS_DIR, '_index.yaml'), 'r') as f:
        author_index = yaml.safe_load(f)['authors']

    seen_dirs = set()
    total = 0
    enriched = 0
    all_additions = {}

    for ref_id, dir_name in author_index.items():
        if dir_name in seen_dirs:
            continue
        seen_dirs.add(dir_name)

        yaml_path = os.path.join(AUTHORS_DIR, dir_name, 'author.yaml')
        if not os.path.exists(yaml_path):
            continue

        with open(yaml_path, 'r') as f:
            author = yaml.safe_load(f)

        if not author:
            continue

        total += 1
        ctext_id = author.get('@id', '').replace('ctext:', '') if author.get('@id') else ''

        if not ctext_id or ctext_id not in ref_persons:
            continue

        ref = ref_persons[ctext_id]
        additions = enrich_author(author, ref, dynasties)

        if additions:
            enriched += 1
            all_additions[dir_name] = {'label': author.get('label'), 'additions': additions}

            # Write back
            with open(yaml_path, 'w', encoding='utf-8') as f:
                yaml.dump(author, f, allow_unicode=True, default_flow_style=False,
                          sort_keys=False)

    print(f"\nProcessed: {total} authors")
    print(f"Enriched: {enriched} authors")

    if all_additions:
        print(f"\nDetails:")
        for dir_name, info in sorted(all_additions.items()):
            print(f"  {dir_name} ({info['label']}): +{info['additions']}")

    print(f"\nDone. {enriched} authors enriched from ctext reference data.")


if __name__ == '__main__':
    main()
