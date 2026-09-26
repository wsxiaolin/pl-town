import type Database from 'better-sqlite3';

// Additive migration: existing construction definitions and money ledgers stay intact.
// The same initializer runs during startup and both backup restore paths.
export function initializeCityVoting(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_votes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES city_projects(id),
      revision INTEGER NOT NULL CHECK(revision >= 0),
      PRIMARY KEY(user_id, project_id)
    );
    CREATE INDEX IF NOT EXISTS city_votes_project ON city_votes(project_id);
    CREATE TABLE IF NOT EXISTS city_vote_operations (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      PRIMARY KEY(user_id, request_id)
    );
  `);
}
