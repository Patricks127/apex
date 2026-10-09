
-- Migration 025: Helper function to resolve an athlete's active plan
-- Returns structured plan info + PDF plan info in one call.
-- Frontend should call this instead of directly querying active_plans.

CREATE OR REPLACE FUNCTION get_athlete_active_plan(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_plan_row record;
  v_pdf_row record;
BEGIN
  -- Check caller is the student or a PT with treinos scope
  IF auth.uid() != p_student_id AND NOT pt_has_scope(auth.uid(), p_student_id, 'treinos') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Try to get structured training plan (highest priority)
  SELECT tp.*
  INTO v_plan_row
  FROM active_plans ap
  JOIN training_plans tp ON tp.id = ap.plan_id
  WHERE ap.student_id = p_student_id;

  IF FOUND THEN
    v_result := jsonb_build_object(
      'type', 'training_plan',
      'id', v_plan_row.id,
      'name', v_plan_row.name,
      'split_style', v_plan_row.split_style,
      'days', v_plan_row.days,
      'progression', v_plan_row.progression,
      'is_active', v_plan_row.is_active,
      'created_at', v_plan_row.created_at
    );
    RETURN v_result;
  END IF;

  -- Fallback: PDF plan from plan_documents
  SELECT pd.*
  INTO v_pdf_row
  FROM plan_documents pd
  WHERE pd.student_id = p_student_id
  ORDER BY pd.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_result := jsonb_build_object(
      'type', 'pdf_plan',
      'id', v_pdf_row.id,
      'name', v_pdf_row.file_name,
      'storage_path', v_pdf_row.storage_path,
      'size_bytes', v_pdf_row.size_bytes,
      'pt_id', v_pdf_row.pt_id,
      'created_at', v_pdf_row.created_at
    );
    RETURN v_result;
  END IF;

  -- No plan at all
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION get_athlete_active_plan IS
  'Returns the athlete''s active plan: structured training_plan if in active_plans, otherwise most recent PDF from plan_documents. Returns NULL if no plan exists. Caller must be the student or a PT with treinos scope.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_athlete_active_plan(uuid) TO authenticated;
