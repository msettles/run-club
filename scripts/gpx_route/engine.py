import math
import sys

from .formatter import (
    COMPASS_SHORT,
    DEFAULT_POI_REPLACEMENTS,
    abbreviate_crossings,
    abbreviate_street,
    compass,
    fmt_dist,
    turn_cue,
    turn_phrase,
)
from .geometry import Projector, angle_diff, bearing, resample, simplify, smooth
from .gpx import read_gpx
from .osm import StreetIndex, fetch_osm


def heading_at(samples, i, window, forward):
    """Heading over `window` metres before (forward=False) or after sample i."""
    d0 = samples[i][1]
    j = i
    if forward:
        while j < len(samples) - 1 and samples[j][1] - d0 < window:
            j += 1
        a, b = samples[i][0], samples[j][0]
    else:
        while j > 0 and d0 - samples[j][1] < window:
            j -= 1
        a, b = samples[j][0], samples[i][0]
    if a == b:
        return None
    return bearing(a, b)


def build_directions(
    gpx_path,
    units="mi",
    step=5.0,
    radius=25.0,
    min_leg=30.0,
    cache=None,
    cross_streets=False,
    osm=None,
    smoothing=12.0,
    tolerance=6.0,
    poi_replacements=None,
):
    """Main routing pipeline: matches GPX track to OSM street network and generates legs."""
    reps = DEFAULT_POI_REPLACEMENTS.copy()
    if poi_replacements:
        reps.update(poi_replacements)

    name, pts = read_gpx(gpx_path)
    lat0 = sum(p[0] for p in pts) / len(pts)
    lon0 = sum(p[1] for p in pts) / len(pts)
    proj = Projector(lat0, lon0)
    xy = [proj.xy(*p) for p in pts]
    xy = simplify(smooth(xy, smoothing), tolerance)  # clean up GPS noise
    samples = resample(xy, step)
    total = samples[-1][1]

    pad = 0.002  # ~200 m
    bbox = (
        min(p[0] for p in pts) - pad,
        min(p[1] for p in pts) - pad,
        max(p[0] for p in pts) + pad,
        max(p[1] for p in pts) + pad,
    )
    if osm is None:
        print("Downloading streets from OpenStreetMap...", file=sys.stderr)
        osm = fetch_osm(bbox, cache)
    idx = StreetIndex(osm, proj)

    # 1. label every sample with a street
    labels = []
    for i, (p, _) in enumerate(samples):
        h = heading_at(samples, i, 10, True) or heading_at(samples, i, 10, False) or 0
        labels.append(idx.match(p, h, radius) or "off-street")

    # majority vote over ~+-15 m so single mismatches at intersections disappear
    k = max(1, int(15 / step))
    voted = []
    for i in range(len(labels)):
        win = labels[max(0, i - k): i + k + 1]
        voted.append(max(set(win), key=lambda l: (win.count(l), l == labels[i])))
    labels = voted

    # 2. runs of identical labels
    runs = []  # [label, start_i, end_i]
    for i, lab in enumerate(labels):
        if runs and runs[-1][0] == lab:
            runs[-1][2] = i
        else:
            runs.append([lab, i, i])

    def run_len(r):
        return samples[r[2]][1] - samples[r[1]][1] + step

    # 3. absorb short noisy runs into neighbours (GPS jitter, intersections)
    changed = True
    while changed and len(runs) > 1:
        changed = False
        shortest = min(range(len(runs)), key=lambda k: run_len(runs[k]))
        if run_len(runs[shortest]) < min_leg:
            k = shortest
            if k == 0:
                runs[1][1] = runs[0][1]
                runs.pop(0)
            elif k == len(runs) - 1:
                runs[-2][2] = runs[-1][2]
                runs.pop()
            else:
                prev, nxt = runs[k - 1], runs[k + 1]
                if prev[0] == nxt[0]:
                    prev[2] = nxt[2]
                    runs.pop(k + 1)
                    runs.pop(k)
                else:  # give it to the longer neighbour
                    if run_len(prev) >= run_len(nxt):
                        prev[2] = runs[k][2]
                    else:
                        nxt[1] = runs[k][1]
                    runs.pop(k)
            # re-merge identical neighbours
            merged = [runs[0]]
            for r in runs[1:]:
                if r[0] == merged[-1][0]:
                    merged[-1][2] = r[2]
                else:
                    merged.append(r)
            runs = merged
            changed = True

    def local_turn_angle(i, win_m=20.0):
        d0 = samples[i][1]
        j_back = i
        while j_back > 0 and d0 - samples[j_back][1] < win_m:
            j_back -= 1
        j_fwd = i
        while j_fwd < len(samples) - 1 and samples[j_fwd][1] - d0 < win_m:
            j_fwd += 1
        p_back, p_cur, p_fwd = samples[j_back][0], samples[i][0], samples[j_fwd][0]
        return angle_diff(bearing(p_back, p_cur), bearing(p_cur, p_fwd))

    # 4. split a run where the route turns (stays on same street or off-street / unmapped)
    final = []
    for lab, s, e in runs:
        cut = s
        i = s + 1
        is_generic = not lab or lab == "off-street" or lab.startswith("unnamed")
        need = 35.0 if is_generic else 45.0

        while i < e:
            ang = local_turn_angle(i, 20.0)
            if (
                abs(ang) >= need
                and samples[i][1] - samples[cut][1] >= min_leg
                and samples[e][1] - samples[i][1] >= min_leg
            ):
                best_i = i
                search_end = min(e, i + int(25.0 / step))
                check_i = i
                while check_i <= search_end:
                    if abs(local_turn_angle(check_i, 20.0)) > abs(local_turn_angle(best_i, 20.0)):
                        best_i = check_i
                    check_i += 1

                final.append([lab, cut, best_i])
                cut = best_i
                i = best_i + int(min_leg / step)
            else:
                i += 1
        final.append([lab, cut, e])
    runs = final

    def turn_at(k):
        s = runs[k][1]
        win = min(
            35,
            max(10, (samples[runs[k][2]][1] - samples[s][1]) / 2),
            max(10, (samples[s][1] - samples[runs[k - 1][1]][1]) / 2),
        )
        hi, ho = heading_at(samples, s, win, False), heading_at(samples, s, win, True)
        return angle_diff(hi, ho) if hi is not None and ho is not None else 0

    # undo same-street splits that turn out not to be real turns (< 35 deg)
    k = 1
    while k < len(runs):
        same_label = runs[k][0] == runs[k - 1][0]
        t_ang = abs(turn_at(k))
        if same_label and t_ang < 35.0:
            runs[k - 1][2] = runs[k][2]
            runs.pop(k)
        else:
            k += 1

    # 5. build the step list
    steps = []
    start_p = samples[0][0]
    poi = idx.nearest_poi(start_p, 60, replacements=reps)
    for k, (lab, s, e) in enumerate(runs):
        leg = samples[e][1] - samples[s][1] + (step if k < len(runs) - 1 else 0)
        h_out = heading_at(samples, s, min(100, max(10, samples[e][1] - samples[s][1])), True) or 0
        card_dir = compass(h_out)
        card_short = COMPASS_SHORT.get(card_dir, "")
        short_lab = abbreviate_street(lab)

        leg_coords = [list(proj.lonlat(*samples[i][0])) for i in range(s, e + 1)]
        start_pt = list(proj.lonlat(*samples[s][0]))

        if k == 0:
            where = f" by {poi[1]}" if poi else ""
            where_concise = f" ({poi[1]})" if poi else ""
            text = f"Start on {lab}{where}, heading {card_dir}"
            concise_text = f"START [{card_short}] {short_lab}{where_concise}"
            cue = "START"
            turn = None
        else:
            delta = turn_at(k)
            phrase = turn_phrase(delta)
            cue = turn_cue(delta)
            if lab == runs[k - 1][0] and abs(delta) >= 20:
                phrase = phrase.replace(" onto", " to stay on")
                concise_text = f"{cue} to stay on {short_lab}"
            else:
                concise_text = f"{cue} on {short_lab}"
            text = f"{phrase} {lab}, heading {card_dir}"
            turn = round(delta)

        item = {
            "step": k + 1,
            "instruction": text,
            "instruction_concise": concise_text,
            "cue": cue,
            "heading_cardinal": card_short,
            "street": lab,
            "street_concise": short_lab,
            "distance_m": round(leg),
            "distance": fmt_dist(leg, units),
            "turn_degrees": turn,
            "at_km": round(samples[s][1] / 1000, 3),
            "point": start_pt,
            "coordinates": leg_coords,
        }
        if cross_streets:
            path = [samples[i][0] for i in range(s, e + 1)]
            crosses = idx.crossings(
                path,
                exclude={lab}
                | ({runs[k - 1][0]} if k else set())
                | ({runs[k + 1][0]} if k + 1 < len(runs) else set()),
            )
            item["crosses"] = crosses
            item["crosses_concise"] = abbreviate_crossings(crosses)
        steps.append(item)

    end_p = samples[-1][0]
    finish_pt = list(proj.lonlat(*end_p))
    loop = math.hypot(end_p[0] - start_p[0], end_p[1] - start_p[1]) < 40
    end_poi = idx.nearest_poi(end_p, 60, replacements=reps)
    finish = "Arrive back at the start" if loop else "Arrive at the finish"
    finish_concise = "FINISH (Start)" if loop else "FINISH"
    if end_poi and not loop:
        finish += f" by {end_poi[1]}"
        finish_concise += f" by {end_poi[1]}"

    return {
        "name": name,
        "total_m": round(total),
        "total": fmt_dist(total, units),
        "loop": loop,
        "steps": steps,
        "finish": finish,
        "finish_concise": finish_concise,
        "finish_point": finish_pt,
    }

