#!/usr/bin/env python3
"""Create author directories for SKQS collection authors missing from the library."""

import os, yaml

AUTHORS_DIR = '/Users/mulgogi/src/chinese/library/authors'

# SKQS authors to add (with ctext data from TTL search)
skqs_authors = [
    {
        'ref': '宋太宗',
        'label': '宋太宗',
        'dir_name': '宋太宗',
        '@id': 'ctext:909601',
        '@type': 'schema:Person',
        'alt_names': ['趙光義', '趙炅', '趙匡乂', '太宗'],
        'dynasty': '宋',
        'ctext_data': {
            'wikidata': 'Q7473',
            'cbdb': '9002',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E5%AE%8B%E5%A4%AA%E5%AE%97',
            'wikipedia_en': 'https://en.wikipedia.org/wiki/Emperor_Taizong_of_Song',
        }
    },
    {
        'ref': '尹文',
        'label': '尹文',
        'dir_name': '尹文',
        '@id': 'ctext:2143423',
        '@type': 'schema:Person',
        'dynasty': '周',
        'ctext_data': {
            'wikidata': 'Q16031704',
            'viaf': '30341350',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E5%B0%B9%E6%96%87',
            'born': '-350',
            'died': '-284',
        }
    },
    {
        'ref': '文子',
        'label': '文子',
        'dir_name': '文子',
        '@id': 'ctext:7641808',
        '@type': 'schema:Person',
        'dynasty': '周',
        'ctext_data': {
            'wikidata': 'Q18234350',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E6%96%87%E5%AD%90',
        }
    },
    {
        'ref': '桓寬',
        'label': '桓寬',
        'dir_name': '桓寬',
        '@id': 'ctext:187891',
        '@type': 'schema:Person',
        'dynasty': '漢',
        'ctext_data': {
            'wikidata': 'Q11113234',
            'viaf': '264172789',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E6%A1%93%E5%AF%AC',
            'name-style': '次公',
        }
    },
    {
        'ref': '趙岐',
        'label': '趙岐',
        'dir_name': '趙岐',
        '@id': 'ctext:528384',
        '@type': 'schema:Person',
        'dynasty': '漢',
        'ctext_data': {
            'wikidata': 'Q5365514',
            'viaf': '66024927',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E8%B5%B5%E5%B2%90',
            'wikipedia_en': 'https://en.wikipedia.org/wiki/Zhao_Qi_(Han_dynasty)',
            'born': '108',
            'died': '201',
        }
    },
    {
        'ref': '鬼谷子',
        'label': '鬼谷子',
        'dir_name': '鬼谷子',
        '@id': 'ctext:433339',
        '@type': 'schema:Person',
        'dynasty': '周',
        'ctext_data': {
            'wikidata': 'Q705744',
            'viaf': '38235856',
            'wikipedia_zh': 'https://zh.wikipedia.org/wiki/%E9%AC%BC%E8%B0%B7%E5%AD%90',
            'wikipedia_en': 'https://en.wikipedia.org/wiki/Guiguzi',
            'born': '-400',
        }
    },
]

# Also add 唐太宗 as alias of C003
alias_additions = [
    {'ref': '唐太宗', 'dir_name': 'C003_李世民'},
]

# Create author directories
for author in skqs_authors:
    dir_name = author['dir_name']
    dir_path = os.path.join(AUTHORS_DIR, dir_name)
    os.makedirs(dir_path, exist_ok=True)

    author_yaml = {
        '@context': 'context.jsonld',
        '@id': author['@id'],
        '@type': author['@type'],
        'ref': author['ref'],
        'label': author['label'],
    }

    if 'alt_names' in author:
        author_yaml['alt_names'] = author['alt_names']

    cd = author.get('ctext_data', {})
    if cd.get('name-style'):
        author_yaml['cprop:name-style'] = cd['name-style']

    if cd.get('born'):
        author_yaml['cprop:born'] = {'@value': str(cd['born']), '@type': 'xsd:gYear'}
    if cd.get('died'):
        author_yaml['cprop:died'] = {'@value': str(cd['died']), '@type': 'xsd:gYear'}

    author_yaml['dynasty'] = author.get('dynasty')

    if cd.get('wikidata'):
        author_yaml['cprop:authority-wikidata'] = cd['wikidata']
    if cd.get('viaf'):
        author_yaml['cprop:authority-viaf'] = cd['viaf']
    if cd.get('cbdb'):
        author_yaml['cprop:authority-cbdb'] = cd['cbdb']
    if cd.get('wikipedia_zh'):
        author_yaml['cprop:link-wikipedia_zh'] = cd['wikipedia_zh']
    if cd.get('wikipedia_en'):
        author_yaml['cprop:link-wikipedia_en'] = cd['wikipedia_en']

    yaml_path = os.path.join(dir_path, 'author.yaml')
    with open(yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(author_yaml, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"Created: {dir_name}/")

# Update _index.yaml
index_path = os.path.join(AUTHORS_DIR, '_index.yaml')
with open(index_path, 'r', encoding='utf-8') as f:
    index = yaml.safe_load(f)

for author in skqs_authors:
    index['authors'][author['ref']] = author['dir_name']

for alias in alias_additions:
    index['authors'][alias['ref']] = alias['dir_name']

index['total'] = len(set(index['authors'].values()))

with open(index_path, 'w', encoding='utf-8') as f:
    yaml.dump(index, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print(f"\nUpdated _index.yaml")
print(f"Total refs: {len(index['authors'])}")
print(f"Unique dirs: {index['total']}")
