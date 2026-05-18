import pytest

import docfusion
from docfusion.main import main


def test_main() -> None:
	"""Test main function runs without error."""
	assert main([]) == 0


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
	"""Test version output uses package metadata."""
	assert main(["--version"]) == 0
	captured = capsys.readouterr()
	assert captured.out.startswith("docfusion ")


def test_import() -> None:
	"""Test that the package can be imported."""
	assert hasattr(docfusion, "__version__")
