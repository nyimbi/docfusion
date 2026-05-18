from docfusion.main import main

def test_main() -> None:
    """Test main function runs without error."""
    main()  # Should not raise any exceptions

def test_import() -> None:
    """Test that the package can be imported."""
    import docfusion
    assert hasattr(docfusion, "__version__")
