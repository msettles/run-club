import json
import math
import os
import sys
import urllib.parse
import urllib.request

from .geometry import bearing, point_seg_dist, segs_intersect

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
USER_AGENT = "gpx-directions-script/1.0"

GENERIC = {
    "service": "service road", "footway": "footpath", "path": "path",
    "cycleway": "bike path", "pedestrian": "pedestrian street", "track": "track",
    "steps": "steps", "bridleway": "bridleway", "corridor": "corridor",
    "living_street": "street", "residential": "street", "unclassified": "road",
}


def fetch_osm(bbox, cache=None):
    """Download OpenStreetMap street & POI network for a bounding box."""
    if cache and os.path.exists(cache):
        with open(cache) as f:
            return json.load(f)
    s, w, n, e = bbox
    q = f"""[out:json][timeout:60];
(
  way["highway"]["highway"!~"proposed|construction|abandoned|platform|elevator"]({s},{w},{n},{e});
  nwr["name"]["amenity"]({s},{w},{n},{e});
  nwr["name"]["shop"]({s},{w},{n},{e});
  nwr["name"]["tourism"]({s},{w},{n},{e});
  nwr["name"]["leisure"]({s},{w},{n},{e});
  nwr["name"]["historic"]({s},{w},{n},{e});
  nwr["name"]["craft"]({s},{w},{n},{e});
);
out tags geom;"""
    data = urllib.parse.urlencode({"data": q}).encode()
    last_err = None
    for url in OVERPASS_URLS:
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as r:
                res = json.load(r)
            if cache:
                with open(cache, "w") as f:
                    json.dump(res, f)
            return res
        except Exception as ex:  # try the next mirror
            last_err = ex
            print(f"  {url} failed: {ex}", file=sys.stderr)
    sys.exit(f"Could not reach any Overpass server ({last_err}).")


def way_label(tags):
    if tags.get("name"):
        return tags["name"]
    if tags.get("ref"):
        return tags["ref"]
    hw = tags.get("highway", "road")
    if hw == "service" and tags.get("service") in ("alley", "parking_aisle", "driveway"):
        return {"alley": "alley", "parking_aisle": "parking lot", "driveway": "driveway"}[tags["service"]]
    if hw == "footway" and tags.get("footway") == "sidewalk":
        return None  # sidewalks: let the street next to them win
    if hw == "footway" and tags.get("footway") == "crossing":
        return None
    return "unnamed " + GENERIC.get(hw, hw.replace("_", " "))


def poi_center(el):
    if "lat" in el:
        return el["lat"], el["lon"]
    if "center" in el:
        return el["center"]["lat"], el["center"]["lon"]
    if "geometry" in el and el["geometry"]:
        g = el["geometry"]
        return sum(p["lat"] for p in g) / len(g), sum(p["lon"] for p in g) / len(g)
    if "bounds" in el:
        b = el["bounds"]
        return (b["minlat"] + b["maxlat"]) / 2, (b["minlon"] + b["maxlon"]) / 2
    return None


class StreetIndex:
    """Spatial index of OSM ways and POIs mapped into local projected metres."""

    def __init__(self, osm, proj, cell=50.0):
        self.cell = cell
        self.grid = {}
        self.segments = []   # (a, b, label, way_id)
        self.pois = []       # (xy, name, kind)
        for el in osm.get("elements", []):
            tags = el.get("tags", {})
            if el["type"] == "way" and "highway" in tags and el.get("geometry"):
                label = way_label(tags)
                if label is None:
                    continue
                geom = [proj.xy(p["lat"], p["lon"]) for p in el["geometry"] if p]
                for a, b in zip(geom, geom[1:]):
                    self._add(a, b, label, el["id"])
            elif tags.get("name") and "highway" not in tags:
                c = poi_center(el)
                if c:
                    kind = next((tags[k] for k in ("amenity", "shop", "tourism", "leisure", "historic", "craft") if k in tags), "")
                    self.pois.append((proj.xy(*c), tags["name"], kind))

    def _add(self, a, b, label, wid):
        idx = len(self.segments)
        self.segments.append((a, b, label, wid))
        x0, x1 = sorted((a[0], b[0]))
        y0, y1 = sorted((a[1], b[1]))
        for gx in range(int(x0 // self.cell), int(x1 // self.cell) + 1):
            for gy in range(int(y0 // self.cell), int(y1 // self.cell) + 1):
                self.grid.setdefault((gx, gy), []).append(idx)

    def near(self, p, radius):
        r = int(radius // self.cell) + 1
        gx, gy = int(p[0] // self.cell), int(p[1] // self.cell)
        seen = set()
        for i in range(gx - r, gx + r + 1):
            for j in range(gy - r, gy + r + 1):
                for idx in self.grid.get((i, j), ()):
                    if idx not in seen:
                        seen.add(idx)
                        yield self.segments[idx]

    def match(self, p, heading, radius):
        """Best street for point p travelling on `heading`, or None."""
        best, best_score = None, float("inf")
        for a, b, label, wid in self.near(p, radius):
            d = point_seg_dist(p, a, b)
            if d > radius:
                continue
            seg_brg = bearing(a, b)
            misalign = abs(math.sin(math.radians(seg_brg - heading)))  # 0 = parallel
            score = d + 25 * misalign
            if label.startswith("unnamed "):
                score += 4  # small preference for named streets
            if score < best_score:
                best, best_score = label, score
        return best

    def nearest_poi(self, p, radius, replacements=None):
        best = None
        for xy, name, kind in self.pois:
            d = math.hypot(xy[0] - p[0], xy[1] - p[1])
            if d <= radius and (best is None or d < best[0]):
                best = (d, name, kind)
        if best:
            d, name, kind = best
            if replacements:
                if name in replacements:
                    name = replacements[name]
                else:
                    for k, v in replacements.items():
                        if k.lower() in name.lower() or name.lower() in k.lower():
                            name = v
                            break
            return (d, name, kind)
        return None

    def crossings(self, path_xy, exclude):
        """Named streets whose segments cross the given polyline, in order."""
        found = []
        for i, (p, q) in enumerate(zip(path_xy, path_xy[1:])):
            mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            rad = math.hypot(q[0] - p[0], q[1] - p[1]) / 2 + 5
            for a, b, label, _ in self.near(mid, rad):
                if label in exclude or label.startswith("unnamed") or label in ("alley", "parking lot", "driveway"):
                    continue
                if segs_intersect(p, q, a, b) and label not in found:
                    found.append(label)
        return found

