"""Day-1 bootstrap test — proves pytest runs in CI, analogous to the Go main_test.go.

Delete or replace once real scout tests land.
"""

import foxbook_scouts


def test_package_importable():
    """The foxbook_scouts package must be importable from the uv workspace."""
    assert foxbook_scouts is not None
