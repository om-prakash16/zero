-- ==============================================================================
-- CROSSWIRE Migration 005: Configurable Room Capacity, Join Requests & Multi-Translations
-- ==============================================================================

-- 1. Extend rooms table with capacity, admission settings, and creator ownership
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS creator_id UUID,
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS admission_mode TEXT NOT NULL DEFAULT 'approval_required';

-- Add constraints if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_room_max_capacity'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT check_room_max_capacity
      CHECK (max_capacity >= 2 AND max_capacity <= 16);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_room_admission_mode'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT check_room_admission_mode
      CHECK (admission_mode IN ('approval_required', 'auto_approve'));
  END IF;
END $$;

-- Backfill creator_id from existing earliest participant where creator_id is null
UPDATE public.rooms r
SET creator_id = sub.user_id
FROM (
  SELECT DISTINCT ON (room_id) room_id, user_id
  FROM public.participants
  ORDER BY room_id, joined_at ASC
) sub
WHERE r.id = sub.room_id AND r.creator_id IS NULL;

-- 2. Create join_requests table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  language_name TEXT NOT NULL DEFAULT 'English',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'declined', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  CONSTRAINT check_request_status CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS join_requests_room_status_idx ON public.join_requests (room_id, status);
CREATE INDEX IF NOT EXISTS join_requests_user_idx ON public.join_requests (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_unique_pending_idx
  ON public.join_requests (room_id, user_id)
  WHERE status = 'pending';

-- 3. Create message_translations table for multi-participant translations
CREATE TABLE IF NOT EXISTS public.message_translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  target_language_name TEXT NOT NULL DEFAULT '',
  translated_text TEXT,
  translation_status TEXT DEFAULT 'pending', -- 'pending', 'translated', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_translation_status CHECK (translation_status IN ('pending', 'translated', 'failed')),
  CONSTRAINT unique_message_target_lang UNIQUE (message_id, target_language)
);

CREATE INDEX IF NOT EXISTS message_translations_room_idx ON public.message_translations (room_id);
CREATE INDEX IF NOT EXISTS message_translations_message_idx ON public.message_translations (message_id);

-- 4. Dynamic Capacity Enforcement Trigger on participants table
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Row lock the room to prevent race conditions during concurrent inserts
  SELECT max_capacity, participant_count
  INTO v_max_capacity, v_current_count
  FROM public.rooms
  WHERE id = NEW.room_id
  FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    v_max_capacity := 2;
  END IF;

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'Room is full. Maximum % participants allowed.', v_max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_room_capacity_trigger ON public.participants;
CREATE TRIGGER check_room_capacity_trigger
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION check_room_capacity();

-- 5. Stored Procedures / RPC Functions for Atomic Admission

-- Function: request_room_admission
CREATE OR REPLACE FUNCTION public.request_room_admission(
  p_room_id UUID,
  p_display_name TEXT,
  p_language_code TEXT,
  p_language_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_room RECORD;
  v_existing_participant RECORD;
  v_request RECORD;
  v_new_participant RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join room';
  END IF;

  -- Lock room row for atomic evaluation
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.is_active = FALSE THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Room not found or inactive');
  END IF;

  -- Check if caller is already a participant
  SELECT * INTO v_existing_participant FROM public.participants
  WHERE room_id = p_room_id AND user_id = v_caller;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_joined', 'participant_id', v_existing_participant.id);
  END IF;

  -- Check capacity
  IF v_room.participant_count >= v_room.max_capacity THEN
    RETURN jsonb_build_object(
      'status', 'room_full',
      'message', format('Room is full. Maximum %s participants allowed.', v_room.max_capacity)
    );
  END IF;

  -- Handle AUTO_APPROVE mode (or creator joining)
  IF v_room.admission_mode = 'auto_approve' OR v_room.creator_id = v_caller THEN
    INSERT INTO public.participants (
      room_id,
      user_id,
      display_name,
      language_code,
      language_name,
      is_connected
    )
    VALUES (
      p_room_id,
      v_caller,
      p_display_name,
      p_language_code,
      p_language_name,
      TRUE
    )
    RETURNING * INTO v_new_participant;

    -- Update or insert join request as approved
    INSERT INTO public.join_requests (
      room_id,
      user_id,
      display_name,
      language_code,
      language_name,
      status,
      resolved_at,
      resolved_by
    )
    VALUES (
      p_room_id,
      v_caller,
      p_display_name,
      p_language_code,
      p_language_name,
      'approved',
      NOW(),
      v_room.creator_id
    )
    ON CONFLICT (room_id, user_id) WHERE status = 'pending'
    DO UPDATE SET
      status = 'approved',
      resolved_at = NOW(),
      resolved_by = v_room.creator_id,
      updated_at = NOW();

    RETURN jsonb_build_object(
      'status', 'admitted',
      'participant_id', v_new_participant.id
    );
  END IF;

  -- Handle APPROVAL_REQUIRED mode
  -- Upsert pending request
  SELECT * INTO v_request FROM public.join_requests
  WHERE room_id = p_room_id AND user_id = v_caller AND status = 'pending';

  IF FOUND THEN
    -- Update details
    UPDATE public.join_requests
    SET display_name = p_display_name,
        language_code = p_language_code,
        language_name = p_language_name,
        updated_at = NOW()
    WHERE id = v_request.id;

    RETURN jsonb_build_object(
      'status', 'pending',
      'request_id', v_request.id
    );
  ELSE
    INSERT INTO public.join_requests (
      room_id,
      user_id,
      display_name,
      language_code,
      language_name,
      status
    )
    VALUES (
      p_room_id,
      v_caller,
      p_display_name,
      p_language_code,
      p_language_name,
      'pending'
    )
    RETURNING * INTO v_request;

    RETURN jsonb_build_object(
      'status', 'pending',
      'request_id', v_request.id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: resolve_join_request
CREATE OR REPLACE FUNCTION public.resolve_join_request(
  p_request_id UUID,
  p_action TEXT -- 'approve' or 'decline'
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req RECORD;
  v_room RECORD;
  v_new_participant RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('approve', 'decline') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  -- Get request
  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'status', v_req.status, 'error', 'Request is already resolved');
  END IF;

  -- Lock room
  SELECT * INTO v_room FROM public.rooms WHERE id = v_req.room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Security check: only creator can approve/decline
  IF v_room.creator_id != v_caller THEN
    RAISE EXCEPTION 'Only the room creator can resolve join requests';
  END IF;

  IF p_action = 'approve' THEN
    -- Check capacity
    IF v_room.participant_count >= v_room.max_capacity THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Room is already at full capacity (%s participants)', v_room.max_capacity)
      );
    END IF;

    -- Insert participant
    INSERT INTO public.participants (
      room_id,
      user_id,
      display_name,
      language_code,
      language_name,
      is_connected
    )
    VALUES (
      v_req.room_id,
      v_req.user_id,
      v_req.display_name,
      v_req.language_code,
      v_req.language_name,
      TRUE
    )
    ON CONFLICT (room_id, user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      language_code = EXCLUDED.language_code,
      language_name = EXCLUDED.language_name,
      is_connected = TRUE
    RETURNING * INTO v_new_participant;

    -- Update request
    UPDATE public.join_requests
    SET status = 'approved',
        resolved_at = NOW(),
        resolved_by = v_caller,
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'approved');
  ELSE
    -- Decline
    UPDATE public.join_requests
    SET status = 'declined',
        resolved_at = NOW(),
        resolved_by = v_caller,
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: cancel_join_request
CREATE OR REPLACE FUNCTION public.cancel_join_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_req.user_id != v_caller THEN
    RAISE EXCEPTION 'You can only cancel your own join request';
  END IF;

  UPDATE public.join_requests
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: update_room_settings
CREATE OR REPLACE FUNCTION public.update_room_settings(
  p_room_id UUID,
  p_max_capacity INTEGER,
  p_admission_mode TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_room RECORD;
  v_req RECORD;
  v_remaining_capacity INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate capacity bounds
  IF p_max_capacity < 2 OR p_max_capacity > 16 THEN
    RAISE EXCEPTION 'Maximum capacity must be between 2 and 16 participants';
  END IF;

  IF p_admission_mode NOT IN ('approval_required', 'auto_approve') THEN
    RAISE EXCEPTION 'Invalid admission mode: %', p_admission_mode;
  END IF;

  -- Lock room
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Security check: only creator can update settings
  IF v_room.creator_id != v_caller THEN
    RAISE EXCEPTION 'Only the room creator can change room settings';
  END IF;

  -- Capacity reduction check: cannot decrease below current admitted participant count
  IF p_max_capacity < v_room.participant_count THEN
    RAISE EXCEPTION 'Capacity cannot be reduced below current participant count (% participants currently admitted)', v_room.participant_count;
  END IF;

  -- Update room
  UPDATE public.rooms
  SET max_capacity = p_max_capacity,
      admission_mode = p_admission_mode,
      updated_at = NOW()
  WHERE id = p_room_id;

  -- If switched to auto_approve, process pending requests in FIFO order up to capacity
  IF p_admission_mode = 'auto_approve' AND v_room.admission_mode != 'auto_approve' THEN
    v_remaining_capacity := p_max_capacity - v_room.participant_count;

    FOR v_req IN
      SELECT * FROM public.join_requests
      WHERE room_id = p_room_id AND status = 'pending'
      ORDER BY created_at ASC
    LOOP
      IF v_remaining_capacity > 0 THEN
        -- Insert as participant
        INSERT INTO public.participants (
          room_id,
          user_id,
          display_name,
          language_code,
          language_name,
          is_connected
        )
        VALUES (
          v_req.room_id,
          v_req.user_id,
          v_req.display_name,
          v_req.language_code,
          v_req.language_name,
          TRUE
        )
        ON CONFLICT (room_id, user_id) DO UPDATE SET is_connected = TRUE;

        UPDATE public.join_requests
        SET status = 'approved',
            resolved_at = NOW(),
            resolved_by = v_caller,
            updated_at = NOW()
        WHERE id = v_req.id;

        v_remaining_capacity := v_remaining_capacity - 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'max_capacity', p_max_capacity,
    'admission_mode', p_admission_mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- join_requests policies
DROP POLICY IF EXISTS "join_requests_select" ON public.join_requests;
CREATE POLICY "join_requests_select" ON public.join_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR room_id IN (SELECT id FROM public.rooms WHERE creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "join_requests_insert" ON public.join_requests;
CREATE POLICY "join_requests_insert" ON public.join_requests
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "join_requests_update" ON public.join_requests;
CREATE POLICY "join_requests_update" ON public.join_requests
  FOR UPDATE USING (
    user_id = auth.uid()
    OR room_id IN (SELECT id FROM public.rooms WHERE creator_id = auth.uid())
  );

-- message_translations policies
DROP POLICY IF EXISTS "message_translations_select" ON public.message_translations;
CREATE POLICY "message_translations_select" ON public.message_translations
  FOR SELECT USING (
    room_id IN (SELECT public.get_my_room_ids())
  );

DROP POLICY IF EXISTS "message_translations_insert" ON public.message_translations;
CREATE POLICY "message_translations_insert" ON public.message_translations
  FOR INSERT WITH CHECK (
    room_id IN (SELECT public.get_my_room_ids())
  );

DROP POLICY IF EXISTS "message_translations_update" ON public.message_translations;
CREATE POLICY "message_translations_update" ON public.message_translations
  FOR UPDATE USING (
    room_id IN (SELECT public.get_my_room_ids())
  );

-- Update rooms_update policy to allow creator to update their room
DROP POLICY IF EXISTS "rooms_update" ON public.rooms;
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (
    creator_id = auth.uid()
    OR id IN (SELECT public.get_my_room_ids())
  );

-- 7. Realtime configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'join_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_translations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_translations;
  END IF;
END $$;
