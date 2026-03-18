import re

def analyze():
    with open('style.css', 'r') as f:
        css = f.read()

    # Find media queries
    media_queries = re.findall(r'@media\s+([^{]+)\{', css)

    # Find important
    important = len(re.findall(r'!important', css))

    # Find z-index values
    z_indexes = re.findall(r'z-index:\s*([0-9]+)\s*;', css)
    unique_z = sorted(list(set([int(z) for z in z_indexes])))

    # Find highly specific selectors (heuristic: more than 2 classes/ids/elements combined without spaces)
    lines = css.split('\n')
    selectors = []
    in_block = False
    for line in lines:
        if '{' in line and not line.strip().startswith('@'):
            selectors.append(line.split('{')[0].strip())

    print(f"Media queries count: {len(media_queries)}")
    print(f"Unique Media Queries: {set(media_queries)}")
    print(f"\n!important count: {important}")
    print(f"\nz-index values used: {unique_z}")
    print(f"Total selectors: {len(selectors)}")

if __name__ == '__main__':
    analyze()
