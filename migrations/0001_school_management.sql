CREATE TABLE IF NOT EXISTS students (
  admission_no TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  father_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  total_fee INTEGER NOT NULL DEFAULT 0 CHECK(total_fee >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT UNIQUE,
  admission_no TEXT NOT NULL,
  student_name TEXT NOT NULL,
  father_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  total_fee INTEGER NOT NULL DEFAULT 0,
  paid_fee INTEGER NOT NULL CHECK(paid_fee > 0),
  payment_date TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admission_no) REFERENCES students(admission_no)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_name TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('P','A','L')),
  remarks TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_name, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_admission ON payments(admission_no);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON staff_attendance(attendance_date);
