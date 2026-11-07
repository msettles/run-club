"""
gpx_route - Turn GPX routes into turn-by-turn street directions using OpenStreetMap.
"""

from .engine import build_directions
from .formatter import (
    DEFAULT_POI_REPLACEMENTS,
    abbreviate_crossings,
    abbreviate_street,
    print_directions,
    to_geojson,
)
from .geometry import Projector, angle_diff, bearing, point_seg_dist, segs_intersect
from .gpx import read_gpx
from .osm import StreetIndex, fetch_osm

__all__ = [
    "build_directions",
    "to_geojson",
    "print_directions",
    "read_gpx",
    "StreetIndex",
    "fetch_osm",
    "Projector",
    "DEFAULT_POI_REPLACEMENTS",
    "abbreviate_street",
    "abbreviate_crossings",
    "bearing",
    "angle_diff",
    "point_seg_dist",
    "segs_intersect",
]

