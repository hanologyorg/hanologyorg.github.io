#!/usr/bin/env python3
"""Merge duplicate author directories that share the same ctext @id."""

import os, re, yaml, shutil
from collections import defaultdict

AUTHORS_DIR = '/Users/mulgogi/src/chinese/library/authors'

# Load all author.yaml files
authors = {}
for d in sorted(os.listdir(AUTHORS_DIR)):
    yaml_path = os.path.join(AUTHORS_DIR, d, 'author.yaml')
    if not os.path.exists(yaml_path):
        continue
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    if data:
        data['_dir'] = d
        authors[d] = data

# Group by @id
ctext_groups = defaultdict(list)
no_id = []
for d, data in authors.items():
    ctext_id = data.get('@id')
    if ctext_id and ctext_id != 'null' and ctext_id is not None:
        ctext_groups[ctext_id].append(data)
    else:
        no_id.append(data)

# Find duplicates
duplicates = {cid: group for cid, group in ctext_groups.items() if len(group) > 1}

print(f"Total directories: {len(authors)}")
print(f"Duplicate groups: {len(duplicates)}")
print(f"Directories in duplicates: {sum(len(g) for g in duplicates.values())}")
print()

# Canonical selection: lowest ref number (A-series sort)
def ref_sort_key(data):
    ref = data.get('ref', 'zzz')
    # Extract number from ref like A006, C003, Laozi
    m = re.match(r'([A-Z]+)(\d+)', ref)
    if m:
        return (m.group(1), int(m.group(2)))
    return ('zzz', 0)

merged = 0
deleted_dirs = []

for ctext_id, group in sorted(duplicates.items()):
    group.sort(key=ref_sort_key)
    canonical = group[0]
    aliases = group[1:]

    canonical_dir = canonical['_dir']
    canonical_ref = canonical.get('ref')
    canonical_label = canonical.get('label')

    alias_refs = [a.get('ref') for a in aliases]
    alias_labels = [a.get('label') for a in aliases]
    alias_dirs = [a['_dir'] for a in aliases]

    print(f"Merging: {canonical_ref} ({canonical_label}) ← {', '.join(alias_refs)}")
    print(f"  canonical dir: {canonical_dir}")
    print(f"  alias dirs: {alias_dirs}")

    # 1. Move brief files from alias dirs to canonical dir
    new_bio_sources = list(canonical.get('bio_sources') or [])

    for alias in aliases:
        alias_dir_path = os.path.join(AUTHORS_DIR, alias['_dir'])
        alias_bio_sources = alias.get('bio_sources') or []

        for bs in alias_bio_sources:
            src_file = os.path.join(alias_dir_path, bs['file'])
            if os.path.exists(src_file):
                # Check if file already exists in canonical dir (avoid overwrite)
                dst_file = os.path.join(AUTHORS_DIR, canonical_dir, bs['file'])
                if os.path.exists(dst_file):
                    # Rename to avoid collision
                    alias_ref = alias.get('ref', 'unknown')
                    base, ext = os.path.splitext(bs['file'])
                    new_name = f"{base}-{alias_ref}{ext}"
                    dst_file = os.path.join(AUTHORS_DIR, canonical_dir, new_name)
                    bs_copy = dict(bs)
                    bs_copy['file'] = new_name
                    new_bio_sources.append(bs_copy)
                else:
                    new_bio_sources.append(bs)

                # Copy file (we'll delete alias dirs later)
                shutil.copy2(src_file, dst_file)
                print(f"    moved: {bs['file']} → {os.path.basename(dst_file)}")

    # 2. Build merged alt_names
    merged_alt_names = list(canonical.get('alt_names') or [])
    for alias in aliases:
        alias_label = alias.get('label')
        if alias_label and alias_label != canonical_label and alias_label not in merged_alt_names:
            merged_alt_names.append(alias_label)
        for alt in (alias.get('alt_names') or []):
            if alt not in merged_alt_names and alt != canonical_label:
                merged_alt_names.append(alt)

    # 3. Update canonical author.yaml
    canonical['alias_refs'] = alias_refs
    if merged_alt_names:
        canonical['alt_names'] = merged_alt_names
    canonical['bio_sources'] = new_bio_sources if new_bio_sources else canonical.get('bio_sources')

    # Remove internal field
    del canonical['_dir']
    for a in aliases:
        if '_dir' in a:
            del a['_dir']

    # Write updated canonical author.yaml
    canonical_yaml_path = os.path.join(AUTHORS_DIR, canonical_dir, 'author.yaml')
    with open(canonical_yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(canonical, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    # 4. Delete alias directories
    for alias_dir in alias_dirs:
        alias_path = os.path.join(AUTHORS_DIR, alias_dir)
        shutil.rmtree(alias_path)
        deleted_dirs.append((alias_dir, canonical_dir))
        print(f"    deleted: {alias_dir}/")

    merged += 1
    print()

# 5. Update _index.yaml
index_path = os.path.join(AUTHORS_DIR, '_index.yaml')
with open(index_path, 'r', encoding='utf-8') as f:
    index = yaml.safe_load(f)

# Build new index
new_authors = {}
for ref, dir_name in index['authors'].items():
    # Check if this ref's directory was deleted (it's an alias)
    found = False
    for deleted_dir, canonical_dir in deleted_dirs:
        if dir_name == deleted_dir:
            # Map to canonical directory
            new_authors[ref] = canonical_dir
            found = True
            break
    if not found:
        new_authors[ref] = dir_name

index['authors'] = new_authors
index['total'] = len(set(new_authors.values()))

with open(index_path, 'w', encoding='utf-8') as f:
    yaml.dump(index, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print(f"\n=== Summary ===")
print(f"Groups merged: {merged}")
print(f"Directories deleted: {len(deleted_dirs)}")
print(f"Remaining directories: {len([d for d in os.listdir(AUTHORS_DIR) if os.path.isdir(os.path.join(AUTHORS_DIR, d)) and not d.startswith('.')])}")
print(f"Total refs in index: {len(new_authors)}")
print(f"Unique directories in index: {len(set(new_authors.values()))}")
