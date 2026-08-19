-- The coverage-gaps read path treats required_count = 0 as meaningful ("explicitly closed that
-- weekday"), which the original constraint refused to store at all.
ALTER TABLE coverage_requirements
  DROP CONSTRAINT coverage_req_count_positive;

ALTER TABLE coverage_requirements
  ADD CONSTRAINT coverage_req_count_nonnegative CHECK (required_count >= 0);
