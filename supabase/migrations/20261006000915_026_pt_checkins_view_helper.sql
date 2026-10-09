
-- Migration 026: PT helper to fetch workout checkins with session details for an athlete
-- The checkins RLS already allows PT to read (pt_has_scope treinos), but
-- we add a convenience function to return checkins with session context
-- so the PT dashboard can show effort/discomfort/notes without extra joins.

CREATE OR REPLACE FUNCTION get_athlete_checkins(p_student_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  session_id uuid,
  session_title text,
  performed_at timestamptz,
  effort text,
  discomfort_zones text[],
  note text,
  n_sets int,
  volume_kg numeric,
  avg_rpe numeric,
  completion numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be the student or a PT with treinos scope
  IF auth.uid() != p_student_id AND NOT pt_has_scope(auth.uid(), p_student_id, 'treinos') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    ws.id AS session_id,
    ws.title AS session_title,
    ws.performed_at,
    wc.effort,
    wc.discomfort_zones,
    wc.note,
    ws.n_sets,
    ws.volume_kg,
    ws.avg_rpe,
    ws.completion
  FROM workout_sessions ws
  LEFT JOIN workout_checkins wc ON wc.session_id = ws.id AND wc.user_id = p_student_id
  WHERE ws.user_id = p_student_id
  ORDER BY ws.performed_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_athlete_checkins IS
  'Returns workout sessions with check-in feedback (effort, discomfort, notes) for a student. Accessible by the student or their PT with treinos scope.';

GRANT EXECUTE ON FUNCTION get_athlete_checkins(uuid, int) TO authenticated;
