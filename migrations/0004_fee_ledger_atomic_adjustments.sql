-- Atomic fee ledger events and approved adjustment audit trail.
-- Additive only: existing fee transactions and assessments remain intact.
ALTER TABLE fee_transactions ADD COLUMN assessment_id INTEGER REFERENCES fee_assessments(id);
ALTER TABLE fee_adjustments ADD COLUMN source_assessment_id INTEGER REFERENCES fee_assessments(id);
ALTER TABLE fee_adjustments ADD COLUMN target_assessment_id INTEGER REFERENCES fee_assessments(id);

-- New payments must reference a valid assessment and cannot exceed its current balance.
CREATE TRIGGER IF NOT EXISTS fee_transaction_validate
BEFORE INSERT ON fee_transactions
BEGIN
  SELECT CASE WHEN NEW.assessment_id IS NULL
    THEN RAISE(ABORT, 'assessment_id_required') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM fee_assessments a
    WHERE a.id=NEW.assessment_id
      AND a.profile_id=NEW.profile_id
      AND a.school_key=NEW.school_key
      AND a.academic_session=NEW.academic_session
      AND a.net_amount-a.paid_amount >= NEW.amount
  ) THEN RAISE(ABORT, 'fee_balance_changed_or_insufficient') END;
END;

-- The collection and assessment balance update happen in the same database statement.
CREATE TRIGGER IF NOT EXISTS fee_transaction_apply
AFTER INSERT ON fee_transactions
BEGIN
  UPDATE fee_assessments
  SET paid_amount=paid_amount+NEW.amount,
      status=CASE WHEN paid_amount+NEW.amount>=net_amount THEN 'paid' ELSE 'partial' END,
      updated_at=CURRENT_TIMESTAMP
  WHERE id=NEW.assessment_id;
END;

CREATE TRIGGER IF NOT EXISTS fee_adjustment_validate
BEFORE INSERT ON fee_adjustments
BEGIN
  SELECT CASE WHEN NEW.source_assessment_id IS NULL
    THEN RAISE(ABORT, 'source_assessment_required') END;
  SELECT CASE WHEN NEW.adjustment_type NOT IN ('refund','carry_forward')
    THEN RAISE(ABORT, 'unsupported_adjustment_type') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM fee_assessments a
    WHERE a.id=NEW.source_assessment_id
      AND a.profile_id=NEW.profile_id
      AND a.school_key=NEW.school_key
      AND a.academic_session=NEW.academic_session
  ) THEN RAISE(ABORT, 'source_assessment_not_found') END;
  SELECT CASE WHEN NEW.amount > (
    SELECT COALESCE(a.paid_amount,0) - COALESCE((
      SELECT SUM(x.amount) FROM fee_adjustments x
      WHERE x.source_assessment_id=a.id
    ),0)
    FROM fee_assessments a WHERE a.id=NEW.source_assessment_id
  ) THEN RAISE(ABORT, 'adjustment_exceeds_available_paid_amount') END;
  SELECT CASE WHEN NEW.adjustment_type='carry_forward' AND (
    NEW.target_assessment_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM fee_assessments t
      JOIN fee_assessments s ON s.id=NEW.source_assessment_id
      WHERE t.id=NEW.target_assessment_id
        AND t.profile_id=s.profile_id
        AND t.academic_session<>s.academic_session
        AND t.net_amount-t.paid_amount>=NEW.amount
    )
  ) THEN RAISE(ABORT, 'valid_target_assessment_required') END;
  SELECT CASE WHEN NEW.adjustment_type='refund' AND NEW.target_assessment_id IS NOT NULL
    THEN RAISE(ABORT, 'refund_cannot_have_target') END;
END;

-- A carry-forward becomes a payment credit in the target session, while the
-- source-session balance is reduced in reports by the immutable adjustment entry.
CREATE TRIGGER IF NOT EXISTS fee_adjustment_apply_carry
AFTER INSERT ON fee_adjustments
WHEN NEW.adjustment_type='carry_forward'
BEGIN
  UPDATE fee_assessments
  SET paid_amount=paid_amount+NEW.amount,
      status=CASE WHEN paid_amount+NEW.amount>=net_amount THEN 'paid' ELSE 'partial' END,
      updated_at=CURRENT_TIMESTAMP
  WHERE id=NEW.target_assessment_id;
END;
