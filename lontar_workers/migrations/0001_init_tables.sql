-- Migration number: 0001 	 2026-07-18T10:19:33.601Z

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    version INTEGER NOT NULL,
    metadata BLOB NOT NULL,
    content BLOB,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    daleted_at INTEGER
);
