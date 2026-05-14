"""
docfusion.experimental — modules that are complete and tested in isolation
but not yet wired into a real product workflow.

Code under this package follows the same quality bar as the rest of the
codebase but should not be imported from production code paths. The naming
convention exists so a reader auditing the architecture can immediately
tell what is a load-bearing dependency vs. what is a reference
implementation pending a real use case.

Promote a module out of experimental/ only when:

  - At least one production code path invokes it
  - The integration is covered by an end-to-end test (not just unit tests
    against the experimental module itself)
  - The product decision to depend on it has been made deliberately, not
    by accident of import

Demote (i.e. move *into* experimental/) modules whose only production
references are dead instantiations or commented stubs.
"""
