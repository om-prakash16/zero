-- CROSSWIRE Migration 002: Secure Messages Update Policy & Translation RPC
-- Description: Enables room participants (both sender and receiver) to update translation columns on messages.
-- Enforces that only translated_text and translation_status can be modified, preventing unauthorized
-- alterations to message ownership (sender_id), room membership (room_id), or message content.

-- 1. Ensure RLS is active on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing update policy if it exists to make this migration idempotent
DROP POLICY IF EXISTS "messages_update" ON public.messages;

-- 3. Create secure UPDATE policy
-- Allows ANY authenticated user who is an active participant in the room to update message translation columns.
-- This supports both sender-driven translation and receiver-driven translation without authorization failures.
-- (select auth.uid()) is used for query planner performance and plan caching.
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    room_id IN (
      SELECT p.room_id FROM public.participants p WHERE p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    room_id IN (
      SELECT p.room_id FROM public.participants p WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- 4. Trigger function to strictly enforce field immutability on UPDATE
-- Ensures that only translated_text and translation_status can ever be modified.
-- Uses IS DISTINCT FROM for NULL-safe comparisons.
CREATE OR REPLACE FUNCTION public.enforce_message_update_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent altering identity, ownership, or room association
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot modify message id';
  END IF;

  IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    RAISE EXCEPTION 'Cannot modify message room_id';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
    RAISE EXCEPTION 'Cannot modify message sender_id';
  END IF;

  -- Prevent altering message content, sender name, language metadata, or timestamps
  IF NEW.sender_name IS DISTINCT FROM OLD.sender_name OR
     NEW.original_text IS DISTINCT FROM OLD.original_text OR
     NEW.source_language IS DISTINCT FROM OLD.source_language OR
     NEW.target_language IS DISTINCT FROM OLD.target_language OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify immutable message columns (sender_name, original_text, languages, created_at)';
  END IF;

  -- Validate allowed translation_status values
  IF NEW.translation_status NOT IN ('pending', 'translated', 'failed') THEN
    RAISE EXCEPTION 'Invalid translation_status value: %', NEW.translation_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach BEFORE UPDATE trigger to public.messages
DROP TRIGGER IF EXISTS enforce_message_update_trigger ON public.messages;
CREATE TRIGGER enforce_message_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_update_columns();

-- 6. Column-level permissions (Defense-in-depth)
-- Revoke full table UPDATE from anon and authenticated roles.
-- Explicitly grant UPDATE only on translated_text and translation_status to authenticated users.
REVOKE UPDATE ON public.messages FROM anon;
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (translated_text, translation_status) ON public.messages TO authenticated;

-- 7. Dedicated RPC Function for Translation Updates
-- Allows clean, audited translation updates from client or server
CREATE OR REPLACE FUNCTION public.update_message_translation(
  p_message_id UUID,
  p_translated_text TEXT,
  p_translation_status TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller is authenticated
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify caller is an active participant in the room containing this message
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.participants p ON p.room_id = m.room_id
    WHERE m.id = p_message_id
      AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a participant in this room';
  END IF;

  -- Validate status
  IF p_translation_status NOT IN ('pending', 'translated', 'failed') THEN
    RAISE EXCEPTION 'Invalid translation_status: %', p_translation_status;
  END IF;

  -- Perform the safe update
  UPDATE public.messages
  SET translated_text = p_translated_text,
      translation_status = p_translation_status
  WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
