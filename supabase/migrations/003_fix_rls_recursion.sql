-- CROSSWIRE Migration 003: Fix RLS Infinite Recursion on Participants Table
-- Description: Uses a SECURITY DEFINER helper function to break recursive RLS evaluation on public.participants.

-- 1. Helper function to fetch room IDs for current user without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_room_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT p.room_id FROM public.participants p WHERE p.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop and recreate participants_select policy using the security definer function
DROP POLICY IF EXISTS "participants_select" ON public.participants;
CREATE POLICY "participants_select" ON public.participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR room_id IN (SELECT public.get_my_room_ids())
  );

-- 3. Update messages_select policy
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    room_id IN (SELECT public.get_my_room_ids())
  );

-- 4. Update messages_insert policy
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND sender_id = auth.uid()
    AND room_id IN (SELECT public.get_my_room_ids())
  );

-- 5. Update messages_update policy
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    room_id IN (SELECT public.get_my_room_ids())
  )
  WITH CHECK (
    room_id IN (SELECT public.get_my_room_ids())
  );

-- 6. Update rooms_update policy
DROP POLICY IF EXISTS "rooms_update" ON public.rooms;
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (
    id IN (SELECT public.get_my_room_ids())
  );

