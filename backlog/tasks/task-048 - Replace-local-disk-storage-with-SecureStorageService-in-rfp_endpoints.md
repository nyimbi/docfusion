---
id: TASK-048
title: Replace local-disk storage with SecureStorageService in rfp_endpoints
status: To Do
assignee: []
created_date: '2026-06-02 08:29'
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
