-- Migration number: 0001 	 2026-07-18T10:19:33.601Z

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    version INTEGER NOT NULL,
    content BLOB,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    daleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS metadata (
    id TEXT PRIMARY KEY NOT NULL,
    metadata BLOB,
    version INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at INTEGER
);
