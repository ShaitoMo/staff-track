-- Restores the original constraint from 20260816112111_shift_periods_and_coverage_requirements.
ALTER TABLE coverage_requirements
  DROP CONSTRAINT coverage_req_count_nonnegative;

ALTER TABLE coverage_requirements
  ADD CONSTRAINT coverage_req_count_positive CHECK (required_count > 0);
