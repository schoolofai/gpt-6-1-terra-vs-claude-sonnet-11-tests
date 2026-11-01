from datetime import datetime, timezone
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")


def _parse(s: str) -> datetime:
    if not isinstance(s, str):
        raise ValueError(f"invalid datetime: {s!r}")
    dt = datetime.fromisoformat(s.strip())
    if dt.tzinfo is None or dt.utcoffset() is None:
        local = dt.replace(tzinfo=LONDON, fold=0)  # fold=0: first occurrence (BST)
        utc = local.astimezone(timezone.utc)
        back = utc.astimezone(LONDON).replace(tzinfo=None)
        if back != dt:
            raise ValueError(f"nonexistent London local time: {s}")
        return utc
    return dt.astimezone(timezone.utc)


def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def merge_bookings(bookings: list[tuple[str, str]]) -> list[tuple[str, str]]:
    parsed = []
    for start, end in bookings:
        s, e = _parse(start), _parse(end)
        if e <= s:
            raise ValueError(f"end must be after start: {start} / {end}")
        parsed.append((s, e))
    parsed.sort()
    merged = []
    for s, e in parsed:
        if merged and s <= merged[-1][1]:
            if e > merged[-1][1]:
                merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(_fmt(s), _fmt(e)) for s, e in merged]
