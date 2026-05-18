from importlib import import_module

import pytest

pytest.importorskip("strawberry")


def test_graphql_schema_imports_with_strawberry_installed():
	schema = import_module("docfusion.api.graphql.schema")

	assert schema.create_graphql_schema is not None
