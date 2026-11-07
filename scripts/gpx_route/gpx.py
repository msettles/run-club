import sys
import xml.etree.ElementTree as ET


def read_gpx(path):
    """Read every trkpt/rtept from GPX and return (route_name, points)."""
    root = ET.parse(path).getroot()
    pts = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag in ("trkpt", "rtept"):
            pts.append((float(el.get("lat")), float(el.get("lon"))))
    name = None
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] == "name" and el.text:
            name = el.text.strip()
            break
    # drop consecutive duplicates
    out = []
    for p in pts:
        if not out or abs(p[0] - out[-1][0]) > 1e-7 or abs(p[1] - out[-1][1]) > 1e-7:
            out.append(p)
    if len(out) < 2:
        sys.exit("GPX file needs at least two distinct track or route points.")
    return name, out

