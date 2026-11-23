CREATE TABLE IF NOT EXISTS parent_portal_credentials (
  profile_id TEXT PRIMARY KEY,
  school_key TEXT NOT NULL,
  login_id TEXT NOT NULL UNIQUE,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Small compressed progress-report PDFs are stored directly in D1.
-- D1 limits each BLOB/row to 2,000,000 bytes; the API enforces 1,500,000 bytes.
CREATE TABLE IF NOT EXISTS progress_report_files (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  report_title TEXT NOT NULL DEFAULT 'Progress Report',
  pdf_blob BLOB NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1500000),
  published INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_reports_profile
  ON progress_report_files(profile_id, published, academic_session);
