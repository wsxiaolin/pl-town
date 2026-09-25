# Server source layout

- `index.ts`: HTTP/WebSocket composition root.
- `auth.ts`: authentication and session token operations.
- `db.ts`: persistence boundary.
- `config.ts`: environment-backed server configuration.
- `logger.ts`: console + file logging with daily rotation and level filtering.
- `types.ts`: messages and shared server-side data contracts.
- `adminAuth.ts` / `adminRouter.ts`: cookie/CSRF administration boundary and routes.
- `backup.ts` / `backupVerifier.ts`: online backups, manifest, retention, and worker verification.
- `offsiteBackup.ts`: Alibaba Cloud OSS upload/download/delete, console restore, empty-start restore, and shutdown upload.
- `deploySnapshot.ts`: bearer-token endpoint used by CI to snapshot the live database to OSS before a Render deploy.
- `restoreBackup.ts` / `runtimeLock.ts`: offline restore and exclusive data-directory ownership.
- `requestSecurity.ts` / `httpBody.ts` / `rateLimit.ts`: transport security helpers.

Keep transport concerns in `index.ts`; persistence and authentication should
remain independently testable modules.

## Construction voting

The House of Commons accepts one free support vote per resident and pending
building project. Voting expresses demand; funding still completes construction
without a vote threshold. `POST /town-api/city/vote` uses the existing resident
token, config version, and request ID contract. `GET /town-api/city/votes` accepts
the resident token in an `Authorization: Bearer` header, returns only that user's
project IDs, and is not cacheable. Public city state and `city.updated` contain
aggregate vote counts only.

Schema 7 adds `city_votes` and `city_vote_operations`. Startup and backup restores
initialize these tables; backups from schemas 5 and 6 start with empty votes and
retain existing construction funding and payment receipts. Offline restore also
writes schema 7 metadata before the server restarts. Existing project definitions and
configuration IDs are unchanged. Vote request receipts are retained just like
payment receipts, including duplicate votes submitted with another request ID.

## Story progress protocol

Story content, display text, and branching rules live in the web client. The
server only persists small, reusable progress records keyed by resident and
story ID:

- `story.get`: `{ storyId }` creates/returns the record.
- `story.update`: `{ storyId, nodeId?, flags?, ending?, visit? }` atomically
  merges flags, replaces supplied node/ending values, and increments
  `visitCount` when `visit` is true.
- Both commands reply with `story.updated`; inspect `event.type` to distinguish
  `story.loaded` from `story.updated`.

IDs and flag keys use portable ASCII identifiers. Flag values are intentionally
limited to JSON primitives so story state stays compact and versionable while
all authored content remains client-side.
