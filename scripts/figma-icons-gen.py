"""Generate components/icons.tsx directly from the exported Figma SVGs.

Reading path data programmatically guarantees byte-exact vector fidelity -
no manual transcription of path data.
"""
import re

SOURCES = [
    ("image_001.svg", "ArrowRightIcon", "16"),
    ("image_002.svg", "SparklesIcon", "20"),
    ("image_003.svg", "BrainIcon", "24"),
    ("image_004.svg", "ShieldIcon", "24"),
    ("image_005.svg", "ChartColumnIcon", "24"),
    ("image_006.svg", "CheckIcon", "16"),
]

HEADER = """// AUTO-GENERATED from Figma exports (.media/images/image_001-006.svg), file ifCw9JuE00PMiaOHgtBxRp node 6:9.
// Vector path data is byte-exact from the Figma source. Regenerate with scripts/figma-icons-gen.py.

"""

TFunc = "TSX"


def to_tsx(svg_text: str, name: str) -> str:
    # Extract inner elements between <svg...> and </svg>
    root_attrs = re.search(r"<svg([^>]*)>", svg_text).group(1)
    viewbox = re.search(r'viewBox="([^"]+)"', root_attrs).group(1)
    w = re.search(r'width="([^"]+)"', root_attrs).group(1)
    h = re.search(r'height="([^"]+)"', root_attrs).group(1)
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg_text, re.S).group(1).strip()
    # Convert attributes to JSX: kebab-case -> camelCase, self-closing ok
    inner = re.sub(r"\bclip-path=", "clipPath=", inner)
    inner = re.sub(r"\bstroke-width=", "strokeWidth=", inner)
    inner = re.sub(r"\bstroke-linecap=", "strokeLinecap=", inner)
    inner = re.sub(r"\bstroke-linejoin=", "strokeLinejoin=", inner)
    inner = re.sub(r"\bfill-rule=", "fillRule=", inner)
    inner = re.sub(r"\bclip-rule=", "clipRule=", inner)
    inner = re.sub(r"\bxmlns:xlink=", "xmlnsXlink=", inner)
    # stroke="#HEX" -> stroke="currentColor"
    inner = inner.replace('stroke="#F5F0EB"', 'stroke="currentColor"')
    inner = inner.replace('stroke="#B5A08E"', 'stroke="currentColor"')
    inner = inner.replace('stroke="#1A1A1A"', 'stroke="currentColor"')
    # indent inner content
    lines = [l for l in inner.splitlines() if l.strip()]
    body = "\n".join("      " + l.strip() for l in lines)
    return f"""export function {name}({{ className }}: {{ className?: string }}) {{
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={{"{w}"}}
      height={{"{h}"}}
      viewBox="{viewbox}"
      fill="none"
      className={{className}}
      aria-hidden
    >
{body}
    </svg>
  );
}}
"""


parts = [HEADER]
for fname, name, _ in SOURCES:
    svg = open(f".media/images/{fname}", encoding="utf-8").read()
    parts.append(to_tsx(svg, name))

out = "\n".join(parts)
with open("components/icons.tsx", "w", encoding="utf-8", newline="\n") as f:
    f.write(out)
print("wrote components/icons.tsx,", len(out), "chars")
