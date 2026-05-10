#!/usr/bin/env python3
"""Parse ALL entities from ctext TTL dump into YAML-LD reference files.

Reads: library/reference-docs/ctext_datawiki-2026-01-22.ttl
Writes: library/reference/ (YAML-LD files by entity type)
"""

import re
import os
import json
import yaml
from collections import defaultdict
from pathlib import Path

TTL_PATH = '/Users/mulgogi/src/chinese/library/reference-docs/ctext_datawiki-2026-01-22.ttl'
OUTPUT_DIR = '/Users/mulgogi/src/chinese/library/reference'
AUTHORS_DIR = '/Users/mulgogi/src/chinese/library/authors'

# Shard size for large types
PERSON_SHARD_SIZE = 5000
WORK_SHARD_SIZE = 5000

# Types small enough for single bulk file
SMALL_TYPES = {'dynasty', 'era', 'place', 'office', 'celestial',
               'event', 'organization', 'examstatus', 'qualifier', 'property'}


def parse_ttl(path):
    """Parse ctext TTL into structured entities.

    ctext TTL uses a claim/stat pattern:
      ctext:ID claim:PROP VALUE ;
          cstat:PROP [ cprop:PROP VALUE ; cqual:QUAL VALUE ] .

    Returns dict: {ctext_id: {type, label, names, claims: {prop: [{value, quals}]}}}
    """
    entities = {}
    current_id = None
    current_claims = {}

    # Regex patterns
    re_entity_start = re.compile(r'^ctext:(\d+)\s+(claim:\S+)\s+(.+?)\s*;\s*$')
    re_entity_cont = re.compile(r'^\s+(cstat:\S+)\s+\[\s*$')
    re_entity_label = re.compile(r'^ctext:(\d+)\s+rdfs:label\s+"(.+)"\s*\.\s*$')
    re_stat_prop = re.compile(r'^\s+(cprop:\S+)\s+(.+?)\s*;?\s*$')
    re_qual = re.compile(r'^\s+(cqual:\S+)\s+(.+?)\s*;?\s*$')
    re_end = re.compile(r'^\s*\]\s*\.\s*$')
    re_end_cont = re.compile(r'^\s*\]\s*\.\s*$')

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')

            # Skip comments and prefixes
            if line.startswith('#') or line.startswith('@prefix') or not line.strip():
                continue

            # Label line: ctext:ID rdfs:label "NAME" .
            m = re_entity_label.match(line)
            if m:
                eid = m.group(1)
                label = m.group(2)
                if eid not in entities:
                    entities[eid] = {'type': None, 'label': label, 'claims': {}}
                else:
                    entities[eid]['label'] = label
                continue

            # Entity start: ctext:ID claim:PROP VALUE ;
            m = re_entity_start.match(line)
            if m:
                eid = m.group(1)
                prop = m.group(2).replace('claim:', '')
                value = m.group(3).strip().strip('"')
                if eid not in entities:
                    entities[eid] = {'type': None, 'label': None, 'claims': {}}
                current_id = eid
                if prop not in entities[eid]['claims']:
                    entities[eid]['claims'][prop] = []
                entities[eid]['claims'][prop].append({'value': value, 'quals': {}})
                continue

            # Statement continuation: cstat:PROP [
            m = re_entity_cont.match(line)
            if m:
                # We're inside a statement block, next lines are cprop:/cqual:
                continue

            # Skip ] . (end of statement)
            if re.match(r'^\s*\]\s*\.\s*$', line):
                continue

            # cprop line inside statement
            m = re_stat_prop.match(line)
            if m and current_id:
                continue  # We already captured the value from the claim line

            # cqual line inside statement
            m = re_qual.match(line)
            if m and current_id:
                prop_key = m.group(1).replace('cqual:', '')
                qual_val = m.group(2).strip().strip('"')
                if entities[current_id]['claims']:
                    # Add qualifier to the last claim
                    for claims_list in entities[current_id]['claims'].values():
                        if claims_list:
                            claims_list[-1]['quals'][prop_key] = qual_val
                continue

    # Extract type for each entity
    for eid, data in entities.items():
        type_claims = data['claims'].get('type', [])
        if type_claims:
            data['type'] = type_claims[0]['value']

    return entities


def _ref(value):
    """Normalize entity reference: strip quotes, ensure ctext: prefix."""
    v = value.strip().strip('"')
    if v.startswith('ctext:'):
        return v
    return f'ctext:{v}'


def entity_to_yaml_ld(eid, data):
    """Convert a parsed entity to YAML-LD dict."""
    result = {
        '@id': f'ctext:{eid}',
        '@type': data['type'] or 'Unknown',
        'label': data['label'],
    }

    claims = data['claims']

    # Names (collect all name values)
    names = [c['value'] for c in claims.get('name', []) if c['value']]
    if len(names) > 1:
        result['names'] = names
    elif len(names) == 1 and names[0] != data['label']:
        result['names'] = names

    # English label
    label_en = [c['value'] for c in claims.get('label_en', [])]
    if label_en:
        result['label_en'] = label_en[0] if len(label_en) == 1 else label_en

    # Type-specific properties
    etype = data['type']

    # --- Person properties ---
    if etype == 'person':
        if 'name-style' in claims:
            result['name-style'] = claims['name-style'][0]['value']
        if 'name-art' in claims:
            result['name-art'] = claims['name-art'][0]['value']
        if 'name-posthumous' in claims:
            result['name-posthumous'] = claims['name-posthumous'][0]['value']
        if 'name-temple' in claims:
            result['name-temple'] = claims['name-temple'][0]['value']
        if 'born' in claims:
            v = claims['born'][0]['value']
            result['born'] = {'@value': v, '@type': 'xsd:gYear'}
        if 'died' in claims:
            v = claims['died'][0]['value']
            result['died'] = {'@value': v, '@type': 'xsd:gYear'}
        if 'born-date' in claims:
            result['born-date'] = claims['born-date'][0]['value']
        if 'died-date' in claims:
            result['died-date'] = claims['died-date'][0]['value']
        if 'died-age' in claims:
            result['died-age'] = claims['died-age'][0]['value']
        if 'associated-dynasty' in claims:
            result['dynasty'] = {'@id': _ref(claims['associated-dynasty'][0]['value'])}
        if 'father' in claims:
            result['father'] = _ref(claims['father'][0]['value'])
        if 'mother' in claims:
            result['mother'] = _ref(claims['mother'][0]['value'])
        if 'held-office' in claims:
            offices = []
            for c in claims['held-office']:
                entry = _ref(c['value'])
                if c['quals'].get('from-date'):
                    entry += f' (from {c["quals"]["from-date"]})'
                offices.append(entry)
            result['held-office'] = offices
        if 'exam-status' in claims:
            result['exam-status'] = [_ref(c['value']) for c in claims['exam-status']]
        if 'associated-place' in claims:
            result['place'] = _ref(claims['associated-place'][0]['value'])

    # --- Work properties ---
    elif etype == 'work':
        if 'creator' in claims:
            result['creator'] = [_ref(c['value']) for c in claims['creator']]
        if 'associated-dynasty' in claims:
            result['dynasty'] = {'@id': _ref(claims['associated-dynasty'][0]['value'])}
        if 'indexed-in' in claims:
            indexed = []
            for c in claims['indexed-in']:
                entry = {'@id': _ref(c['value'])}
                if 'juan-size' in c['quals']:
                    entry['juan'] = int(c['quals']['juan-size'])
                if 'stated-category' in c['quals']:
                    entry['category'] = c['quals']['stated-category']
                indexed.append(entry)
            result['indexed-in'] = indexed
        if 'part-of' in claims:
            result['part-of'] = [_ref(c['value']) for c in claims['part-of']]
        if 'kind-of' in claims:
            result['kind-of'] = [_ref(c['value']) for c in claims['kind-of']]
        if 'commentary-on' in claims:
            result['commentary-on'] = _ref(claims['commentary-on'][0]['value'])
        if 'sourcetype' in claims:
            result['sourcetype'] = claims['sourcetype'][0]['value']

    # --- Place properties ---
    elif etype == 'place':
        if 'location' in claims:
            loc = claims['location'][0]
            result['location'] = loc['value']
            if loc['quals'].get('authority-hvd'):
                result['authority-hvd'] = loc['quals']['authority-hvd']
        if 'part-of' in claims:
            result['part-of'] = _ref(claims['part-of'][0]['value'])
        if 'population-households' in claims:
            result['population-households'] = claims['population-households'][0]['value']
        if 'population-persons' in claims:
            result['population-persons'] = claims['population-persons'][0]['value']

    # --- Dynasty properties ---
    elif etype == 'dynasty':
        if 'from-date' in claims:
            result['from'] = claims['from-date'][0]['value']
        if 'to-date' in claims:
            result['to'] = claims['to-date'][0]['value']
        if 'ruler' in claims:
            rulers = []
            for c in claims['ruler']:
                entry = {'@id': _ref(c['value'])}
                if c['quals'].get('from-date'):
                    entry['from'] = c['quals']['from-date']
                if c['quals'].get('to-date'):
                    entry['to'] = c['quals']['to-date']
                rulers.append(entry)
            result['rulers'] = rulers

    # --- Era properties ---
    elif etype == 'era':
        if 'from-date' in claims:
            result['from'] = claims['from-date'][0]['value']
        if 'to-date' in claims:
            result['to'] = claims['to-date'][0]['value']
        if 'ruler' in claims:
            rulers = []
            for c in claims['ruler']:
                entry = {'@id': _ref(c['value'])}
                if c['quals'].get('from-date'):
                    entry['from'] = c['quals']['from-date']
                if c['quals'].get('to-date'):
                    entry['to'] = c['quals']['to-date']
                rulers.append(entry)
            result['rulers'] = rulers

    # --- Office properties ---
    elif etype == 'office':
        pass  # Usually just name and label

    # --- Common authority/link properties for ALL types ---
    if 'authority-wikidata' in claims:
        result['wikidata'] = claims['authority-wikidata'][0]['value']
    if 'authority-viaf' in claims:
        result['viaf'] = claims['authority-viaf'][0]['value']
    if 'authority-cbdb' in claims:
        result['cbdb'] = claims['authority-cbdb'][0]['value']
    if 'authority-ddbc' in claims:
        result['ddbc'] = claims['authority-ddbc'][0]['value']
    if 'authority-sinica' in claims:
        result['sinica'] = claims['authority-sinica'][0]['value']
    if 'link-wikipedia_zh' in claims:
        result['wikipedia_zh'] = claims['link-wikipedia_zh'][0]['value']
    if 'link-wikipedia_en' in claims:
        result['wikipedia_en'] = claims['link-wikipedia_en'][0]['value']

    return result


def write_bulk_yaml(path, entities, type_name):
    """Write entities as multi-document YAML-LD file."""
    docs = []
    for eid in sorted(entities.keys(), key=lambda x: int(x)):
        docs.append(entity_to_yaml_ld(eid, entities[eid]))

    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'# ctext.org {type_name} entities ({len(docs)} total)\n')
        f.write(f'# Source: ctext_datawiki-2026-01-22.ttl (CC-BY-NC-SA 3.0)\n')
        f.write('---\n')
        yaml.dump_all(docs, f, allow_unicode=True, default_flow_style=False,
                       sort_keys=False, explicit_start=True)

    print(f"  Written: {path} ({len(docs)} {type_name})")
    return len(docs)


def write_sharded_yaml(base_dir, entities, type_name, shard_size):
    """Write large entity sets as sharded YAML files with index."""
    os.makedirs(base_dir, exist_ok=True)

    sorted_ids = sorted(entities.keys(), key=lambda x: int(x))
    total = len(sorted_ids)
    num_shards = (total + shard_size - 1) // shard_size

    index = {}

    for shard_idx in range(num_shards):
        start = shard_idx * shard_size
        end = min(start + shard_size, total)
        shard_ids = sorted_ids[start:end]

        shard_path = os.path.join(base_dir, f'{type_name}s-{shard_idx:03d}.yaml')
        docs = []
        for eid in shard_ids:
            docs.append(entity_to_yaml_ld(eid, entities[eid]))
            index[eid] = f'{type_name}s-{shard_idx:03d}.yaml'

        with open(shard_path, 'w', encoding='utf-8') as f:
            f.write(f'# ctext.org {type_name} entities (shard {shard_idx}, {len(docs)} entities)\n')
            f.write(f'# Source: ctext_datawiki-2026-01-22.ttl (CC-BY-NC-SA 3.0)\n')
            f.write('---\n')
            yaml.dump_all(docs, f, allow_unicode=True, default_flow_style=False,
                           sort_keys=False, explicit_start=True)

        print(f"  Written: {shard_path} ({len(docs)} {type_name})")

    # Write index
    index_path = os.path.join(base_dir, '_index.yaml')
    with open(index_path, 'w', encoding='utf-8') as f:
        yaml.dump({'_shard_size': shard_size, 'total': total,
                   'shards': num_shards, 'index': index},
                  f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"  Written: {index_path} (index for {total} {type_name})")
    return total


def write_context(output_dir):
    """Write shared JSON-LD context for reference data."""
    context = {
        "@context": {
            "@vocab": "https://library.cham.zone/vocab/",
            "ctext": "https://data.ctext.org/entity/",
            "cprop": "https://data.ctext.org/property/",
            "cqual": "https://data.ctext.org/qualifier/",
            "cstat": "https://data.ctext.org/statement/",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "schema": "https://schema.org/",
            "lib": "https://library.cham.zone/vocab/",
            "date": "https://data.ctext.org/date/",
            "label": "rdfs:label",
            "label_en": "rdfs:label@en",
            "names": {"@id": "schema:name", "@container": "@list"},
            "name-style": "cprop:name-style",
            "name-art": "cprop:name-art",
            "name-posthumous": "cprop:name-posthumous",
            "name-temple": "cprop:name-temple",
            "born": "cprop:born",
            "died": "cprop:died",
            "born-date": "cprop:born-date",
            "died-date": "cprop:died-date",
            "died-age": "cprop:died-age",
            "dynasty": "cprop:associated-dynasty",
            "father": "cprop:father",
            "mother": "cprop:mother",
            "held-office": "cprop:held-office",
            "exam-status": "cprop:exam-status",
            "place": "cprop:associated-place",
            "creator": "cprop:creator",
            "indexed-in": "cprop:indexed-in",
            "part-of": "cprop:part-of",
            "kind-of": "cprop:kind-of",
            "commentary-on": "cprop:commentary-on",
            "location": "cprop:location",
            "from": "cprop:from-date",
            "to": "cprop:to-date",
            "rulers": "cprop:ruler",
            "ruler": "cprop:ruler",
            "ruled": "cprop:ruled",
            "wikidata": "cprop:authority-wikidata",
            "viaf": "cprop:authority-viaf",
            "cbdb": "cprop:authority-cbdb",
            "ddbc": "cprop:authority-ddbc",
            "sinica": "cprop:authority-sinica",
            "wikipedia_zh": "cprop:link-wikipedia_zh",
            "wikipedia_en": "cprop:link-wikipedia_en",
            "ref": "lib:ref",
            "alt_names": "lib:altNames",
            "bio_sources": "lib:bioSources",
        }
    }

    path = os.path.join(output_dir, 'context.jsonld')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(context, f, ensure_ascii=False, indent=2)
    print(f"  Written: {path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Parsing ctext TTL...")
    entities = parse_ttl(TTL_PATH)
    print(f"  Total entities: {len(entities)}")

    # Group by type
    by_type = defaultdict(dict)
    for eid, data in entities.items():
        t = data['type'] or 'unknown'
        by_type[t][eid] = data

    print("\nEntity type counts:")
    for t in sorted(by_type.keys(), key=lambda x: -len(by_type[x])):
        print(f"  {t}: {len(by_type[t])}")

    # Write context
    print("\nWriting YAML-LD reference files...")
    write_context(OUTPUT_DIR)

    # Write small types as single bulk files
    type_counts = {}
    for type_name in SMALL_TYPES:
        if type_name in by_type:
            count = write_bulk_yaml(
                os.path.join(OUTPUT_DIR, f'{type_name}.yaml'),
                by_type[type_name], type_name)
            type_counts[type_name] = count

    # Write persons (sharded)
    if 'person' in by_type:
        count = write_sharded_yaml(
            os.path.join(OUTPUT_DIR, 'person'),
            by_type['person'], 'person', PERSON_SHARD_SIZE)
        type_counts['person'] = count

    # Write works (sharded)
    if 'work' in by_type:
        count = write_sharded_yaml(
            os.path.join(OUTPUT_DIR, 'work'),
            by_type['work'], 'work', WORK_SHARD_SIZE)
        type_counts['work'] = count

    # Write summary
    summary = {
        'source': 'ctext_datawiki-2026-01-22.ttl',
        'license': 'CC-BY-NC-SA 3.0',
        'total_entities': len(entities),
        'types': type_counts,
    }
    summary_path = os.path.join(OUTPUT_DIR, '_summary.yaml')
    with open(summary_path, 'w', encoding='utf-8') as f:
        yaml.dump(summary, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    print(f"\n  Written: {summary_path}")

    # Build cross-reference index: ctext_id → type
    xref_path = os.path.join(OUTPUT_DIR, '_type-index.json')
    type_index = {}
    for eid, data in entities.items():
        type_index[eid] = data['type']
    with open(xref_path, 'w', encoding='utf-8') as f:
        json.dump(type_index, f)
    print(f"  Written: {xref_path}")

    # Build name → ctext_id index for lookup
    name_index = defaultdict(list)
    for eid, data in entities.items():
        if data['label']:
            name_index[data['label']].append(eid)
        for c in data['claims'].get('name', []):
            if c['value'] not in [data['label']]:
                name_index[c['value']].append(eid)

    name_path = os.path.join(OUTPUT_DIR, '_name-index.json')
    with open(name_path, 'w', encoding='utf-8') as f:
        json.dump(dict(name_index), f, ensure_ascii=False)
    print(f"  Written: {name_path} ({len(name_index)} unique names)")

    print("\nDone.")


if __name__ == '__main__':
    main()
