-- The private proof chunk size is a protocol constant, not a per-tier
-- admission limit. The API no longer writes or reads these columns. The
-- defaults let older API images (rolling-deploy replicas and rollback targets)
-- keep inserting and selecting tickets. Drop the columns in
-- https://github.com/exalto-ai/notary/issues/522.
ALTER TABLE notary_api.admission_tickets
    ALTER COLUMN max_private_chunk_bytes SET DEFAULT 131072,
    ALTER COLUMN max_private_chunk_commitments SET DEFAULT 128;
