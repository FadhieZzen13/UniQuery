-- Phase 3: auto-hide trigger on flags

CREATE OR REPLACE FUNCTION resolve_flag_question_id(flag_target_type TEXT, flag_target_id UUID)
RETURNS UUID AS $$
  SELECT CASE
    WHEN flag_target_type = 'QUESTION' THEN flag_target_id
    ELSE (SELECT question_id FROM answers WHERE id = flag_target_id)
  END;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auto_hide_on_flags()
RETURNS TRIGGER AS $$
DECLARE
  question_id UUID;
  recent_flags INT;
  question_score NUMERIC;
BEGIN
  question_id := resolve_flag_question_id(NEW.target_type, NEW.target_id);
  IF question_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_flags
  FROM flags
  WHERE target_type = 'QUESTION'
    AND target_id = question_id
    AND created_at > now() - interval '60 minutes'
    AND status = 'OPEN';

  SELECT hot_score INTO question_score
  FROM questions
  WHERE id = question_id;

  IF recent_flags >= 5 OR question_score < -10 THEN
    UPDATE questions SET status = 'HIDDEN' WHERE id = question_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_hide_flags ON flags;
CREATE TRIGGER trg_auto_hide_flags
AFTER INSERT ON flags
FOR EACH ROW
EXECUTE FUNCTION auto_hide_on_flags();
