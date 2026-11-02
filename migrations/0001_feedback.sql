-- D1 database "bazaar-ledger-feedback" (binding DB). Applied once; kept here as documentation.
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, lang TEXT, item INTEGER, page TEXT, kind TEXT, msg TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new');
CREATE TABLE IF NOT EXISTS errors (sig TEXT PRIMARY KEY, msg TEXT, src TEXT, line INTEGER, col INTEGER, page TEXT, ua TEXT, ver TEXT, first_at TEXT, last_at TEXT, count INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS reports_at ON reports(at);
