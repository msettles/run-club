DEFAULT_POI_REPLACEMENTS = {
    "United States Post Office": "Blue Note Brewing",
}

STREET_SUFFIXES = {
    "Street": "St",
    "Avenue": "Ave",
    "Boulevard": "Blvd",
    "Drive": "Dr",
    "Road": "Rd",
    "Lane": "Ln",
    "Court": "Ct",
    "Place": "Pl",
    "Circle": "Cir",
    "Parkway": "Pkwy",
    "Highway": "Hwy",
    "Way": "Way",
}

COMPASS_SHORT = {
    "north": "N",
    "northeast": "NE",
    "east": "E",
    "southeast": "SE",
    "south": "S",
    "southwest": "SW",
    "west": "W",
    "northwest": "NW",
}


def turn_phrase(delta):
    """Verbose narrative turn phrase."""
    a = abs(delta)
    side = "right" if delta > 0 else "left"
    if a < 20:
        return "Continue onto"
    if a < 45:
        return f"Bear {side} onto"
    if a < 135:
        return f"Turn {side} onto"
    if a < 165:
        return f"Make a sharp {side} onto"
    return "Make a U-turn onto"


def turn_cue(delta):
    """Short turn code for mobile / cue-sheet display (L, R, Slight L, etc.)."""
    if delta is None:
        return "START"
    a = abs(delta)
    side = "R" if delta > 0 else "L"
    if a < 20:
        return "CONT"
    if a < 45:
        return f"Slight {side}"
    if a < 135:
        return side
    if a < 165:
        return f"Sharp {side}"
    return "U-turn"


def abbreviate_street(name):
    """Shorten street type suffixes (e.g. 3rd Street -> 3rd St)."""
    if not name:
        return name
    words = name.split()
    if len(words) > 1 and words[-1] in STREET_SUFFIXES:
        words[-1] = STREET_SUFFIXES[words[-1]]
        return " ".join(words)
    return name


def abbreviate_crossings(crossings):
    """Shorten crossed street names for compact mobile display."""
    out = []
    for c in crossings:
        words = c.split()
        if len(words) > 1 and words[-1] in STREET_SUFFIXES:
            # Drop the generic suffix if preceded by a specific name
            out.append(" ".join(words[:-1]))
        else:
            out.append(c)
    return out


def compass(b):
    """Full compass heading name."""
    dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
    return dirs[int((b + 22.5) // 45) % 8]


def fmt_dist(m, units):
    """Format distance in metres as feet/miles or m/km."""
    if units == "km":
        return f"{m:.0f} m" if m < 1000 else f"{m / 1000:.2f} km"
    mi = m / 1609.344
    return f"{m * 3.28084:.0f} ft" if mi < 0.1 else f"{mi:.2f} mi"


def print_directions(d, show_cross=False, fmt="both"):
    """Print turn-by-turn directions in verbose, concise, or both formats."""
    title = d["name"] or "Route"
    header = f"{title}  -  {d['total']}{' loop' if d['loop'] else ''}"

    if fmt in ("verbose", "both"):
        if fmt == "both":
            print(f"=== Verbose Directions: {header} ===\n")
        else:
            print(f"{header}\n")
        for s in d["steps"]:
            print(f"{s['step']:>2}. {s['instruction']} for {s['distance']}")
            if show_cross and s.get("crosses"):
                print(f"      crossing {', '.join(s['crosses'])}")
        print(f"{len(d['steps']) + 1:>2}. {d['finish']}.")
        if fmt == "verbose":
            print("\nMap data (c) OpenStreetMap contributors")

    if fmt == "both":
        print("\n" + "=" * 54 + "\n")

    if fmt in ("concise", "both"):
        if fmt == "both":
            print(f"=== Mobile Cue Sheet: {header} ===\n")
        else:
            print(f"{header}\n")
        for s in d["steps"]:
            cross_str = ""
            if show_cross and s.get("crosses_concise"):
                cross_str = f" (x {', '.join(s['crosses_concise'])})"
            print(f"{s['step']:>2}. {s['instruction_concise']} [{s['distance']}]{cross_str}")
        print(f"{len(d['steps']) + 1:>2}. {d.get('finish_concise', d['finish'])}")
        print("\nMap data (c) OpenStreetMap contributors")


def to_geojson(d):
    """Convert directions dict `d` to a standard GeoJSON FeatureCollection."""
    features = []

    # 1. Full continuous route LineString
    full_coords = []
    for s in d.get("steps", []):
        coords = s.get("coordinates", [])
        if not full_coords:
            full_coords.extend(coords)
        else:
            if coords and coords[0] == full_coords[-1]:
                full_coords.extend(coords[1:])
            else:
                full_coords.extend(coords)

    if full_coords:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": full_coords,
            },
            "properties": {
                "feature_type": "route",
                "name": d.get("name") or "Route",
                "total": d.get("total"),
                "total_m": d.get("total_m"),
                "loop": d.get("loop", False),
            }
        })

    # 2. Individual street legs (LineString per leg with maneuver properties)
    for s in d.get("steps", []):
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": s.get("coordinates", []),
            },
            "properties": {
                "feature_type": "leg",
                "step": s["step"],
                "street": s["street"],
                "street_concise": s.get("street_concise", s["street"]),
                "instruction": s["instruction"],
                "instruction_concise": s.get("instruction_concise"),
                "cue": s.get("cue"),
                "distance": s["distance"],
                "distance_m": s["distance_m"],
                "turn_degrees": s.get("turn_degrees"),
                "crosses": s.get("crosses", []),
            }
        })

    # 3. Decision / turn points (Point per step)
    for s in d.get("steps", []):
        pt = s.get("point")
        if pt:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": pt,
                },
                "properties": {
                    "feature_type": "turn",
                    "step": s["step"],
                    "cue": s.get("cue"),
                    "instruction": s["instruction"],
                    "instruction_concise": s.get("instruction_concise"),
                    "street": s["street"],
                    "distance": s["distance"],
                    "at_km": s.get("at_km"),
                }
            })

    # 4. Finish point
    fpt = d.get("finish_point")
    if fpt:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": fpt,
            },
            "properties": {
                "feature_type": "finish",
                "step": len(d.get("steps", [])) + 1,
                "cue": "FINISH",
                "instruction": d.get("finish"),
                "instruction_concise": d.get("finish_concise"),
                "loop": d.get("loop", False),
            }
        })

    return {
        "type": "FeatureCollection",
        "properties": {
            "name": d.get("name") or "Route",
            "total": d.get("total"),
            "total_m": d.get("total_m"),
            "loop": d.get("loop", False),
        },
        "features": features,
    }

