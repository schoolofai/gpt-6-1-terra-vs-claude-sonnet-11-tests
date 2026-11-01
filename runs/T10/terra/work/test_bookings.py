import unittest

from bookings import merge_bookings


class MergeBookingsTests(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(merge_bookings([]), [])

    def test_sorted_merge_overlap_touch_and_containment(self):
        bookings = [
            ("2024-01-01T14:00:00Z", "2024-01-01T15:00:00Z"),
            ("2024-01-01T10:00:00Z", "2024-01-01T12:00:00Z"),
            ("2024-01-01T11:00:00+00:00", "2024-01-01T11:30:00+00:00"),
            ("2024-01-01T13:00:00+01:00", "2024-01-01T14:30:00+01:00"),
            ("2024-01-01T13:15:00Z", "2024-01-01T14:00:00Z"),
        ]
        self.assertEqual(merge_bookings(bookings), [
            ("2024-01-01T10:00:00Z", "2024-01-01T15:00:00Z")
        ])

    def test_london_winter_and_summer(self):
        self.assertEqual(merge_bookings([
            ("2024-07-01T12:00:00", "2024-07-01T13:00:00"),
            ("2024-01-01T12:00:00", "2024-01-01T13:00:00"),
        ]), [
            ("2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z"),
            ("2024-07-01T11:00:00Z", "2024-07-01T12:00:00Z"),
        ])

    def test_spring_gap_and_boundaries(self):
        for time in ("2024-03-31T01:00:00", "2024-03-31T01:30:00", "2024-03-31T01:59:59"):
            with self.subTest(time=time):
                with self.assertRaises(ValueError):
                    merge_bookings([(time, "2024-03-31T03:00:00")])
                with self.assertRaises(ValueError):
                    merge_bookings([("2024-03-31T00:00:00", time)])
        self.assertEqual(merge_bookings([
            ("2024-03-31T00:59:59", "2024-03-31T02:00:00"),
        ]), [("2024-03-31T00:59:59Z", "2024-03-31T01:00:00Z")])
        # An explicit offset denotes an instant even within the wall-time gap.
        self.assertEqual(merge_bookings([
            ("2024-03-31T01:30:00+00:00", "2024-03-31T02:00:00+00:00"),
        ]), [("2024-03-31T01:30:00Z", "2024-03-31T02:00:00Z")])

    def test_autumn_fold_uses_first_occurrence(self):
        self.assertEqual(merge_bookings([
            ("2024-10-27T01:15:00", "2024-10-27T01:45:00"),
        ]), [("2024-10-27T00:15:00Z", "2024-10-27T00:45:00Z")])
        self.assertEqual(merge_bookings([
            ("2024-10-27T01:15:00+00:00", "2024-10-27T01:45:00+00:00"),
        ]), [("2024-10-27T01:15:00Z", "2024-10-27T01:45:00Z")])

    def test_invalid_order_compared_as_instants(self):
        for start, end in [
            ("2024-01-01T10:00:00Z", "2024-01-01T10:00:00+00:00"),
            ("2024-01-01T10:00:00Z", "2024-01-01T09:00:00Z"),
            ("2024-07-01T12:00:00Z", "2024-07-01T12:30:00"),
        ]:
            with self.subTest(start=start, end=end):
                with self.assertRaises(ValueError):
                    merge_bookings([(start, end)])

    def test_fractional_seconds_used_before_formatting(self):
        self.assertEqual(merge_bookings([
            ("2024-01-01T00:00:00.1Z", "2024-01-01T00:00:01.2Z"),
            ("2024-01-01T00:00:01.3Z", "2024-01-01T00:00:02.9Z"),
        ]), [
            ("2024-01-01T00:00:00Z", "2024-01-01T00:00:01Z"),
            ("2024-01-01T00:00:01Z", "2024-01-01T00:00:02Z"),
        ])

    def test_utc_year_is_zero_padded(self):
        self.assertEqual(merge_bookings([
            ("0001-01-01T00:00:00Z", "0001-01-01T00:00:01Z"),
        ]), [("0001-01-01T00:00:00Z", "0001-01-01T00:00:01Z")])

    def test_malformed(self):
        with self.assertRaises(ValueError):
            merge_bookings([("not a date", "2024-01-01T10:00:00Z")])


if __name__ == "__main__":
    unittest.main()
