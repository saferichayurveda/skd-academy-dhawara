-- Fee settings are additive: existing students, receipts and payments remain untouched.
CREATE TABLE IF NOT EXISTS fee_settings (
  academic_session TEXT NOT NULL,
  class_name TEXT NOT NULL,
  monthly_fee INTEGER NOT NULL CHECK(monthly_fee >= 0),
  quarterly_discount_percent REAL NOT NULL DEFAULT 0 CHECK(quarterly_discount_percent >= 0 AND quarterly_discount_percent <= 100),
  half_yearly_discount_percent REAL NOT NULL DEFAULT 10 CHECK(half_yearly_discount_percent >= 0 AND half_yearly_discount_percent <= 100),
  yearly_discount_percent REAL NOT NULL DEFAULT 15 CHECK(yearly_discount_percent >= 0 AND yearly_discount_percent <= 100),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (academic_session, class_name)
);
CREATE TABLE IF NOT EXISTS fee_session_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  current_session TEXT NOT NULL,
  next_session TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO fee_session_settings (id, current_session, next_session)
VALUES (1, '2026-27', '2027-28');
