"""Shared helpers for the Phangan Slope Monitoring page: data store (monthly .npz files), ThingsBoard fetch, page build.

Data layout (data/<station>/<YYYY-MM>.npz, minute grid in ICT):
  m0      absolute minute index (0 = 2026-08-25 09:00 ICT) of the first sample in the file
  q_<ch>  int32 array, value / scale rounded; -32768 = no sample
data/meta.json keeps, per station, the ordered channel list with scale / lo (the page decodes q * scale + lo).
"""
import base64, datetime, json, os, time, urllib.parse, urllib.request, zlib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
T0 = 1787623200                      # 2026-08-25 09:00 ICT, minute index 0
NAN_Q = -32768
ICT = datetime.timezone(datetime.timedelta(hours=7))

TB_HOST = "https://thingsboard.sitearound.com"
TB_PUBLIC_ID = "ba6ead80-6132-11f0-92c5-81d8b0125e9b"        # the public dashboard's customer id (read-only)
TB_DEVICES = {"st1": "7273b210-6860-11f1-801f-81d8b0125e9b", "st2": "1a2a2790-6862-11f1-801f-81d8b0125e9b"}


# ---------------------------------------------------------------- encoding used inside the page
def z_b64(a):
    return base64.b64encode(zlib.compress(np.asarray(a, dtype="<i4").tobytes(), 9)).decode()


def inflate_i32(b64):
    return np.frombuffer(zlib.decompress(base64.b64decode(b64)), "<i4")


# ---------------------------------------------------------------- month store
def month_of_index(m):
    return datetime.datetime.fromtimestamp(T0 + 60 * int(m), ICT).strftime("%Y-%m")


def month_bounds(key):
    """absolute minute index range [first, last] (inclusive) covered by month `key`, clipped to start at T0."""
    y, mo = int(key[:4]), int(key[5:7])
    start = datetime.datetime(y, mo, 1, tzinfo=ICT)
    end = datetime.datetime(y + (mo == 12), mo % 12 + 1, 1, tzinfo=ICT)
    first = max(0, int(round((start.timestamp() - T0) / 60)))
    last = int(round((end.timestamp() - T0) / 60)) - 1
    return first, last


def load_meta():
    return json.load(open(os.path.join(DATA, "meta.json")))


def load_station(st, meta):
    """-> {channel: int32 array over minute 0..N-1} concatenated from every month file (missing = NaN_Q)."""
    d = os.path.join(DATA, st)
    files = sorted(f for f in os.listdir(d) if f.endswith(".npz"))
    names = [c["name"] for c in meta[st]]
    parts = []
    for f in files:
        z = np.load(os.path.join(d, f))
        parts.append((int(z["m0"]), {n: z["q_" + n] for n in names if "q_" + n in z.files}))
    total = max(m0 + len(next(iter(arrs.values()))) for m0, arrs in parts)
    out = {n: np.full(total, NAN_Q, dtype=np.int32) for n in names}
    for m0, arrs in parts:
        for n, a in arrs.items():
            out[n][m0:m0 + len(a)] = a
    return out


def save_station(st, meta, arrs):
    """split the concatenated arrays back into per-month files (only rewrites months that changed)."""
    d = os.path.join(DATA, st)
    os.makedirs(d, exist_ok=True)
    total = len(next(iter(arrs.values())))
    keys, m = [], 0
    while m < total:
        k = month_of_index(m)
        keys.append(k)
        m = month_bounds(k)[1] + 1
    changed = []
    for k in keys:
        first, last = month_bounds(k)
        last = min(last, total - 1)
        payload = {"m0": np.int64(first)}
        for c in meta[st]:
            payload["q_" + c["name"]] = arrs[c["name"]][first:last + 1]
        path = os.path.join(d, k + ".npz")
        if os.path.exists(path):
            z = np.load(path)
            if all(("q_" + c["name"]) in z.files and np.array_equal(z["q_" + c["name"]], payload["q_" + c["name"]]) for c in meta[st]) and int(z["m0"]) == first:
                continue
        np.savez_compressed(path, **payload)
        changed.append(k)
    return changed


def last_valid_index(arrs):
    best = -1
    for a in arrs.values():
        idx = np.nonzero(a != NAN_Q)[0]
        if len(idx):
            best = max(best, int(idx[-1]))
    return best


def station_extra(st, meta, arrs):
    """the EXTRA_STn object the page expects, trimmed to the last minute that has any sample."""
    n = last_valid_index(arrs) + 1
    series = []
    for c in meta[st]:
        q = arrs[c["name"]][:n].astype("int64")
        d = np.diff(np.concatenate([[0], q])).astype("<i4")
        series.append({"name": c["name"], "scale": c["scale"], "lo": c["lo"], "z": z_b64(d)})
    return {"t0": T0, "n": n, "dt": z_b64(np.full(n - 1, 60, dtype="<i4")), "series": series}, n


# ---------------------------------------------------------------- ThingsBoard
def _req(path, data=None, token=None):
    last = None
    for attempt in range(6):
        try:
            r = urllib.request.Request(TB_HOST + path, data=json.dumps(data).encode() if data is not None else None,
                                       headers={"Content-Type": "application/json", **({"X-Authorization": "Bearer " + token} if token else {})})
            with urllib.request.urlopen(r, timeout=90) as f:
                return json.loads(f.read().decode())
        except Exception as e:                      # network hiccup: wait and retry
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def tb_fetch(start_s, end_s, names_by_station):
    """raw 1-minute samples for [start_s, end_s] (epoch s): {station: {channel: [(ts_s, value), ...]}}"""
    tok = _req("/api/auth/login/public", {"publicId": TB_PUBLIC_ID})["token"]
    out = {}
    for st, dev in TB_DEVICES.items():
        keys = ",".join(names_by_station[st])
        data = {n: [] for n in names_by_station[st]}
        t = int(start_s * 1000)
        end = int(end_s * 1000)
        while t < end:
            t2 = min(t + 7 * 86400 * 1000 - 1, end)
            q = urllib.parse.urlencode({"keys": keys, "startTs": t, "endTs": t2, "limit": 100000, "agg": "NONE", "orderBy": "ASC"})
            r = _req(f"/api/plugins/telemetry/DEVICE/{dev}/values/timeseries?{q}", token=tok)
            for k, arr in r.items():
                if k in data:
                    data[k].extend((p["ts"] / 1000.0, p["value"]) for p in arr)
            t = t2 + 1
        out[st] = data
    return out


def quantize(value, scale):
    q = int(round(float(value) / scale))
    if not (-2 ** 31 < q < 2 ** 31) or q == NAN_Q:
        return NAN_Q
    return q


# ---------------------------------------------------------------- page
def build_page(template_path, out_path):
    meta = load_meta()
    html = open(template_path, encoding="utf-8").read()
    last_epoch = 0
    for st, tag in (("st1", "__EXTRA_ST1__"), ("st2", "__EXTRA_ST2__")):
        arrs = load_station(st, meta)
        extra, n = station_extra(st, meta, arrs)
        assert tag in html, tag
        html = html.replace(tag, json.dumps(extra, separators=(",", ":")), 1)
        last_epoch = max(last_epoch, T0 + 60 * (n - 1))
    stamp = datetime.datetime.fromtimestamp(last_epoch, ICT).strftime("%d %b %Y %H:%M")
    assert "__DATA_END__" in html
    html = html.replace("__DATA_END__", stamp)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    open(out_path, "w", encoding="utf-8").write(html)
    return stamp, len(html.encode("utf-8"))
