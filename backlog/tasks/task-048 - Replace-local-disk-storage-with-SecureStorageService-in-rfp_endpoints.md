---
id: TASK-048
title: Replace local-disk storage with SecureStorageService in rfp_endpoints
status: Done
assignee: []
created_date: '2026-06-02 08:29'
updated_date: '2026-06-02 10:47'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
rfp_endpoints.py uses _local_storage_path() (local filesystem) for RFP file storage. The W3c plan was to swap this for SecureStorageService. Storage key format is already aligned (orgs/{org}/rfp/{rfp_id}/{filename}).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SecureStorageService injected into rfp_endpoints via the service container,_local_storage_path() and _LOCAL_STORAGE_ROOT removed,Upload writes bytes via storage_service.store(),Parse reads bytes via storage_service.retrieve() using the storage_key,Existing tests pass; new test covers the round-trip through the service
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Introduced storage/blob_store.py with BlobStore protocol + LocalBlobStore (preserves current behaviour). Injected into rfp_endpoints via Depends(get_blob_store). execute_parse_pipeline accepts optional blob_store param defaulting to module-level LocalBlobStore so Temporal activity call-site is unchanged. _local_storage_path/_LOCAL_STORAGE_ROOT removed from both files. 7 CI tests added.
<!-- SECTION:NOTES:END -->
