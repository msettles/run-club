import math

EARTH_R = 6371008.8


class Projector:
    """Equirectangular projection to local metres - accurate enough for a few km."""

    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = math.radians(1) * EARTH_R * math.cos(math.radians(lat0))
        self.ky = math.radians(1) * EARTH_R

    def xy(self, lat, lon):
        return ((lon - self.lon0) * self.kx, (lat - self.lat0) * self.ky)

    def lonlat(self, x, y):
        """Unproject local metres back to (lon, lat)."""
        return (round(self.lon0 + x / self.kx, 6), round(self.lat0 + y / self.ky, 6))


def bearing(a, b):
    """Compass bearing (0=N, 90=E) from point a to b, both (x, y) in metres."""
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) % 360


def angle_diff(a, b):
    """Signed difference b-a in degrees, in (-180, 180]. Positive = clockwise = right."""
    return (b - a + 540) % 360 - 180


def point_seg_dist(p, a, b):
    ax, ay = a
    dx, dy = b[0] - ax, b[1] - ay
    l2 = dx * dx + dy * dy
    t = 0 if l2 == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def segs_intersect(p1, p2, p3, p4):
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2 = ccw(p3, p4, p1), ccw(p3, p4, p2)
    d3, d4 = ccw(p1, p2, p3), ccw(p1, p2, p4)
    return (d1 * d2 < 0) and (d3 * d4 < 0)


def resample(xy, step):
    """Points every `step` metres along the polyline, with cumulative distance."""
    out = [(xy[0], 0.0)]
    dist, carry = 0.0, 0.0
    for a, b in zip(xy, xy[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if seg == 0:
            continue
        pos = step - carry
        while pos <= seg:
            t = pos / seg
            out.append(((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])), dist + pos))
            pos += step
        carry = seg - (pos - step)
        dist += seg
    if out[-1][1] < dist:
        out.append((xy[-1], dist))
    return out


def smooth(xy, half_window):
    """Moving average along the line (by distance), removes GPS jitter."""
    if half_window <= 0:
        return xy
    dense = resample(xy, 2.0)
    pts = [p for p, _ in dense]
    k = max(1, int(half_window / 2.0))
    n = len(pts)
    # prefix sums for O(n)
    sx, sy = [0.0], [0.0]
    for x, y in pts:
        sx.append(sx[-1] + x)
        sy.append(sy[-1] + y)
    out = []
    for i in range(n):
        a, b = max(0, i - k), min(n, i + k + 1)
        out.append(((sx[b] - sx[a]) / (b - a), (sy[b] - sy[a]) / (b - a)))
    out[0], out[-1] = pts[0], pts[-1]
    return out


def simplify(xy, tol):
    """Douglas-Peucker line simplification (iterative)."""
    if len(xy) < 3 or tol <= 0:
        return xy
    keep = [False] * len(xy)
    keep[0] = keep[-1] = True
    stack = [(0, len(xy) - 1)]
    while stack:
        s, e = stack.pop()
        best, bi = 0.0, None
        for i in range(s + 1, e):
            d = point_seg_dist(xy[i], xy[s], xy[e])
            if d > best:
                best, bi = d, i
        if bi is not None and best > tol:
            keep[bi] = True
            stack += [(s, bi), (bi, e)]
    return [p for p, k in zip(xy, keep) if k]

