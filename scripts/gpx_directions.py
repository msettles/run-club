#!/usr/bin/env python3
"""
gpx_directions.py - Turn a GPX track/route into turn-by-turn street directions.

Usage
  python3 gpx_directions.py course.gpx
  python3 gpx_directions.py course.gpx --format concise     # mobile cue sheet
  python3 gpx_directions.py course.gpx --format verbose     # narrative directions
  python3 gpx_directions.py course.gpx --format both        # both formats (default)
  python3 gpx_directions.py course.gpx --units km --json directions.json
  python3 gpx_directions.py course.gpx --geojson route.geojson   # GeoJSON map export
  python3 gpx_directions.py course.gpx --cache osm.json      # save/reuse OSM data
  python3 gpx_directions.py course.gpx --cross-streets       # list streets crossed
  python3 gpx_directions.py course.gpx --poi-replace "Old Name=New Name"

No third-party packages needed (Python 3.8+).
Map data (c) OpenStreetMap contributors, ODbL.
"""
import argparse
import json
import os
import sys

# Ensure gpx_route package can be imported regardless of working directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from gpx_route import build_directions, print_directions, to_geojson


def parse_args():
    ap = argparse.ArgumentParser(
        description="Turn a GPX file into street directions using OpenStreetMap."
    )
    ap.add_argument("gpx", help="Path to GPX course file")
    ap.add_argument(
        "--format",
        choices=["both", "verbose", "concise"],
        default="both",
        help="output style: verbose narrative, concise mobile cue sheet, or both (default: both)",
    )
    ap.add_argument("--units", choices=["mi", "km"], default="mi", help="distance units (default: mi)")
    ap.add_argument("--json", metavar="FILE", help="also write the directions as JSON")
    ap.add_argument("--geojson", metavar="FILE", help="also write the directions and geometry as GeoJSON")
    ap.add_argument("--cache", metavar="FILE", help="save/reuse the downloaded OSM data")
    ap.add_argument("--cross-streets", action="store_true", help="list named streets crossed on each leg")
    ap.add_argument("--radius", type=float, default=25.0, help="max distance (m) from GPX to a street (default 25)")
    ap.add_argument(
        "--min-leg",
        type=float,
        default=30.0,
        help="ignore street changes shorter than this (m, default 30)",
    )
    ap.add_argument(
        "--smoothing",
        type=float,
        default=12.0,
        help="GPS smoothing half-window in m, 0 = off (default 12)",
    )
    ap.add_argument(
        "--tolerance",
        type=float,
        default=6.0,
        help="line simplification tolerance in m (default 6)",
    )
    ap.add_argument(
        "--poi-replace",
        action="append",
        default=[],
        metavar="OLD=NEW",
        help="custom landmark replacements (e.g. --poi-replace 'USPS=Blue Note Brewing')",
    )
    return ap.parse_args()


def main():
    args = parse_args()

    custom_reps = {}
    for item in args.poi_replace:
        if "=" in item:
            k, v = item.split("=", 1)
            custom_reps[k.strip()] = v.strip()

    d = build_directions(
        args.gpx,
        units=args.units,
        radius=args.radius,
        min_leg=args.min_leg,
        cache=args.cache,
        cross_streets=args.cross_streets,
        smoothing=args.smoothing,
        tolerance=args.tolerance,
        poi_replacements=custom_reps,
    )

    print_directions(d, args.cross_streets, fmt=args.format)

    if args.json:
        with open(args.json, "w") as f:
            json.dump(d, f, indent=2)

    if args.geojson:
        gj = to_geojson(d)
        with open(args.geojson, "w") as f:
            json.dump(gj, f, indent=2)


if __name__ == "__main__":
    main()
