"""Tests for scraper deduplication logic."""
import hashlib

import pytest


def compute_fingerprint(title: str, organization: str | None, deadline: str | None) -> str:
    """Compute SHA256 fingerprint for deduplication."""
    components = [
        title.lower().strip() if title else "",
        (organization or "").lower().strip(),
        deadline or "",
    ]
    combined = "|".join(components)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


class TestFingerprintComputation:
    """Test fingerprint computation for deduplication."""

    def test_fingerprint_is_consistent(self):
        """Same input produces same fingerprint."""
        fp1 = compute_fingerprint("Test RFP", "Org", "2026-04-01")
        fp2 = compute_fingerprint("Test RFP", "Org", "2026-04-01")
        assert fp1 == fp2

    def test_fingerprint_is_sha256_length(self):
        """Fingerprint is 64 characters (SHA256 hex)."""
        fp = compute_fingerprint("Test", "Org", "2026-01-01")
        assert len(fp) == 64

    def test_fingerprint_normalizes_case(self):
        """Title case does not affect fingerprint."""
        fp1 = compute_fingerprint("Test RFP", "Org", "2026-01-01")
        fp2 = compute_fingerprint("test rfp", "Org", "2026-01-01")
        assert fp1 == fp2

    def test_fingerprint_strips_leading_trailing_whitespace(self):
        """Leading/trailing whitespace is stripped from title."""
        fp1 = compute_fingerprint("Test RFP", "Org", "2026-01-01")
        fp2 = compute_fingerprint("  Test RFP  ", "Org", "2026-01-01")
        assert fp1 == fp2

    def test_fingerprint_internal_whitespace_preserved(self):
        """Internal whitespace is preserved (different fingerprints)."""
        fp1 = compute_fingerprint("Test RFP", "Org", "2026-01-01")
        fp2 = compute_fingerprint("Test   RFP", "Org", "2026-01-01")
        assert fp1 != fp2  # Different internal spacing = different fingerprint

    def test_different_titles_different_fingerprints(self):
        """Different titles produce different fingerprints."""
        fp1 = compute_fingerprint("RFP One", "Org", "2026-01-01")
        fp2 = compute_fingerprint("RFP Two", "Org", "2026-01-01")
        assert fp1 != fp2

    def test_different_orgs_different_fingerprints(self):
        """Different organizations produce different fingerprints."""
        fp1 = compute_fingerprint("Title", "Org A", "2026-01-01")
        fp2 = compute_fingerprint("Title", "Org B", "2026-01-01")
        assert fp1 != fp2

    def test_different_deadlines_different_fingerprints(self):
        """Different deadlines produce different fingerprints."""
        fp1 = compute_fingerprint("Title", "Org", "2026-01-01")
        fp2 = compute_fingerprint("Title", "Org", "2026-02-01")
        assert fp1 != fp2

    def test_missing_fields_handled(self):
        """Missing fields are handled gracefully."""
        fp = compute_fingerprint("Test", None, None)
        assert len(fp) == 64

    def test_empty_strings_handled(self):
        """Empty strings are handled."""
        fp = compute_fingerprint("", "", "")
        assert len(fp) == 64


class TestDeduplicateOpportunities:
    """Test opportunity deduplication logic."""

    def deduplicate(self, opportunities: list[dict]) -> list[dict]:
        """Deduplicate opportunities by fingerprint."""
        seen = set()
        result = []
        for opp in opportunities:
            fp = compute_fingerprint(
                opp.get("title", ""),
                opp.get("organization"),
                opp.get("deadline")
            )
            if fp not in seen:
                seen.add(fp)
                result.append(opp)
        return result

    def test_removes_exact_duplicates(self):
        """Exact duplicates are removed."""
        opps = [
            {"title": "RFP 1", "organization": "Org", "deadline": "2026-01-01"},
            {"title": "RFP 1", "organization": "Org", "deadline": "2026-01-01"},
        ]
        result = self.deduplicate(opps)
        assert len(result) == 1

    def test_preserves_unique_opportunities(self):
        """Unique opportunities are preserved."""
        opps = [
            {"title": "RFP 1", "organization": "Org A", "deadline": "2026-01-01"},
            {"title": "RFP 2", "organization": "Org B", "deadline": "2026-01-02"},
            {"title": "RFP 3", "organization": "Org C", "deadline": "2026-01-03"},
        ]
        result = self.deduplicate(opps)
        assert len(result) == 3

    def test_handles_empty_list(self):
        """Empty list returns empty."""
        result = self.deduplicate([])
        assert result == []

    def test_preserves_original_objects(self):
        """Original opportunity objects are preserved."""
        opps = [{"title": "RFP", "organization": "Org", "deadline": "2026-01-01"}]
        result = self.deduplicate(opps)
        assert result[0] is opps[0]

    def test_normalizes_before_dedup(self):
        """Normalization happens before deduplication."""
        opps = [
            {"title": "Test RFP", "organization": "Org", "deadline": "2026-01-01"},
            {"title": "  test rfp  ", "organization": "Org", "deadline": "2026-01-01"},
        ]
        result = self.deduplicate(opps)
        assert len(result) == 1