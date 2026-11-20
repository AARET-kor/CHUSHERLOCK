"""Build chmonitor/dashboard.html from tools/dashboard.tpl.html with the logos inlined.

The page carries its images as data: URIs so it shows correctly whatever server
version is running. Edit the template, then: python3 tools/build_dashboard.py
"""

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "chmonitor" / "static"


def uri(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((STATIC / name).read_bytes()).decode()


def main() -> None:
    page = (ROOT / "tools" / "dashboard.tpl.html").read_text(encoding="utf-8")
    svg = (STATIC / "skylrk.svg").read_text(encoding="utf-8").replace("clip0_6_1527", "skyclip")
    first = page.index("__SKY_SVG__")
    page = page[:first] + svg + page[first + len("__SKY_SVG__"):]
    page = page.replace("__SKY_SVG__", svg.replace("skyclip", "skyclip2"))  # ids must be unique
    page = page.replace("__CROSS__", uri("cross.png")).replace("__BANNER__", uri("banner.png"))
    page = page.replace("__FAVICON__", uri("favicon.png"))
    (ROOT / "chmonitor" / "dashboard.html").write_text(page, encoding="utf-8")
    print(f"dashboard.html {len(page):,} bytes")


if __name__ == "__main__":
    main()
