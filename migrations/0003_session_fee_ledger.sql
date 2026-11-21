-- Additive fee-management foundation.
-- Does not alter or delete student_profiles, students, payments, or existing receipts.
-- profile_id is the stable identity because current admission_no values are blank.

CREATE TABLE IF NOT EXISTS student_session_enrollments (
  profile_id TEXT NOT NULL,
  school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  class_name TEXT NOT NULL,
  enrollment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('active','left','transferred')),
  monthly_fee INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  concession_type TEXT NOT NULL DEFAULT 'none'
    CHECK (concession_type IN ('none','fixed','percent')),
  concession_value REAL NOT NULL DEFAULT 0 CHECK (concession_value >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, academic_session),
  FOREIGN KEY (profile_id) REFERENCES student_profiles(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_session_enrollments_session_class
  ON student_session_enrollments(academic_session, school_key, class_name, enrollment_status);

CREATE TABLE IF NOT EXISTS fee_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  fee_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  base_amount INTEGER NOT NULL CHECK (base_amount >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'due'
    CHECK (status IN ('due','partial','paid','waived','adjusted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, academic_session, fee_period),
  FOREIGN KEY (profile_id, academic_session)
    REFERENCES student_session_enrollments(profile_id, academic_session)
);

CREATE INDEX IF NOT EXISTS idx_fee_assessments_due
  ON fee_assessments(academic_session, school_key, status, profile_id);

CREATE TABLE IF NOT EXISTS fee_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT NOT NULL UNIQUE,
  profile_id TEXT NOT NULL,
  school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  remarks TEXT NOT NULL DEFAULT '',
  student_name_snapshot TEXT NOT NULL,
  father_name_snapshot TEXT NOT NULL DEFAULT '',
  class_name_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id, academic_session)
    REFERENCES student_session_enrollments(profile_id, academic_session)
);

CREATE INDEX IF NOT EXISTS idx_fee_transactions_session_date
  ON fee_transactions(academic_session, payment_date);

CREATE TABLE IF NOT EXISTS fee_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('refund','carry_forward','waiver')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  decision_date TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id, academic_session)
    REFERENCES student_session_enrollments(profile_id, academic_session)
);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_session
  ON fee_adjustments(academic_session, school_key, profile_id);
