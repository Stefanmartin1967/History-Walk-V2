import re
from collections import Counter

def analyze():
    with open('style.css', 'r') as f:
        content = f.read()

    # Simple regex to get blocks
    blocks = re.findall(r'([^{]+)\{([^}]+)\}', content)

    selectors = []
    for selector, rules in blocks:
        selector = selector.strip()
        if not selector or selector.startswith('@'):
            continue

        # Split by comma for multiple selectors
        for s in selector.split(','):
            s = s.strip()
            # Count elements, classes, ids
            ids = s.count('#')
            classes = s.count('.')
            elements = len(re.findall(r'\b[a-zA-Z]+\b', s.replace('.', ' ').replace('#', ' ')))

            # Simple heuristic for high specificity (e.g. 2 IDs, or 1 ID + 3 classes)
            if ids > 0 or classes > 2 or (classes >= 2 and elements >= 2):
                selectors.append(s)

    print(f"High specificity selectors found: {len(selectors)}")
    print("Top 10 most specific (by length/complexity heuristic):")

    def spec_score(s):
        return s.count('#') * 100 + s.count('.') * 10 + len(s.split())

    for s in sorted(selectors, key=spec_score, reverse=True)[:10]:
        print(f"  {s}")

    # Analyze colors/backgrounds to check for hardcoded values vs variables
    hardcoded_colors = re.findall(r'(color|background(?:-color)?):\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))', content)
    print(f"\nHardcoded colors found: {len(hardcoded_colors)}")

    # Check for variables usage
    vars_usage = re.findall(r'var\(--[^)]+\)', content)
    print(f"CSS Variables usage count: {len(vars_usage)}")

if __name__ == '__main__':
    analyze()
