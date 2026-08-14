import unittest

from app.api.notes import normalize_tags


class NormalizeTagsTests(unittest.TestCase):
    def test_normalizes_deduplicates_and_limits_tags(self):
        tags = [" Work ", "WORK", "", *[f"tag-{index}" for index in range(20)]]

        result = normalize_tags(tags)

        self.assertEqual(result[0], "work")
        self.assertEqual(len(result), 12)
        self.assertEqual(len(result), len(set(result)))

    def test_limits_tag_length(self):
        self.assertEqual(normalize_tags(["x" * 30]), ["x" * 24])
