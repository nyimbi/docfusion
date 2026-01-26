import pytest
from src.proposal_writer.main import main

def test_main() -> None:
    """Test main function runs without error."""
    main()  # Should not raise any exceptions

def test_import() -> None:
    """Test that the package can be imported."""
    import src.proposal_writer
    assert hasattr(src.proposal_writer, "__version__")
