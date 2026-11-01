"""Merge bookings using Europe/London for times without an offset."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo


_LONDON = ZoneInfo("Europe/London")


def _to_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        # fold=0 selects the first occurrence of a repeated wall time.
        local = parsed.replace(tzinfo=_LONDON, fold=0)
        utc = local.astimezone(UTC)
        # A nonexistent wall time cannot survive a UTC round trip unchanged.
        if utc.astimezone(_LONDON).replace(tzinfo=None) != parsed:
            raise ValueError(f"Nonexistent Europe/London wall time: {value!r}")
        return utc
    return parsed.astimezone(UTC)


def _format_utc(value: datetime) -> str:
    # Output is specified to have whole-second precision; fractional seconds
    # are retained during merging and truncated only when formatting.
    return value.isoformat(timespec="seconds").removesuffix("+00:00") + "Z"


def merge_bookings(bookings: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Validate and merge overlapping or touching bookings, returning UTC.

    Naive times are interpreted in Europe/London, with ambiguous times using
    their first occurrence. Fractional seconds are truncated in the output.
    """
    intervals: list[tuple[datetime, datetime]] = []
    for start, end in bookings:
        start_utc, end_utc = _to_utc(start), _to_utc(end)
        if end_utc <= start_utc:
            raise ValueError("Booking end must be strictly after its start")
        intervals.append((start_utc, end_utc))

    intervals.sort()
    merged: list[tuple[datetime, datetime]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            previous_start, previous_end = merged[-1]
            merged[-1] = (previous_start, max(previous_end, end))
        else:
            merged.append((start, end))

    return [(_format_utc(start), _format_utc(end)) for start, end in merged]
