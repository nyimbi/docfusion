#!/usr/bin/env python3
"""
Extract core tender sources from Python modules and output as JSON
Only processes files with consistent Source_ID schema
"""
import json
import sys
import importlib.util
from pathlib import Path

def load_module(filepath: Path):
    """Dynamically load a Python module from file path"""
    spec = importlib.util.spec_from_file_location(filepath.stem, filepath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def extract_sources_from_module(module) -> list:
    """Extract source lists from a module"""
    sources = []
    for name in dir(module):
        obj = getattr(module, name)
        if isinstance(obj, list) and len(obj) > 0:
            if isinstance(obj[0], dict) and 'Source_ID' in obj[0]:
                sources.extend(obj)
    return sources

def main():
    script_dir = Path(__file__).parent / "source_scripts"
    all_sources = []
    seen_ids = set()

    # Only process core files with consistent schema
    files = [
        "africa_east.py",
        "africa_central.py",
        "africa_southern.py",
        "africa_north.py",
        "build_database.py",
        "international_institutions.py",
        "latin_america.py",
        "asia_south.py",
        "asia_southeast_pacific.py",
        "middle_east.py",
        "expansion_africa.py",
        "expansion_subnational.py",
    ]

    for filename in files:
        filepath = script_dir / filename
        if not filepath.exists():
            print(f"Skipping {filename} - not found", file=sys.stderr)
            continue

        try:
            module = load_module(filepath)
            sources = extract_sources_from_module(module)
            new_sources = [s for s in sources if s['Source_ID'] not in seen_ids]
            seen_ids.update(s['Source_ID'] for s in new_sources)
            all_sources.extend(new_sources)
            print(f"Loaded {len(new_sources)} sources from {filename}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading {filename}: {e}", file=sys.stderr)

    print(f"\nTotal unique sources: {len(all_sources)}", file=sys.stderr)

    # Output JSON to stdout
    print(json.dumps(all_sources, indent=2))

if __name__ == "__main__":
    main()
