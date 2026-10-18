-- CROSSWIRE Database Schema
-- Run these migrations in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ROOMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  participant_count INTEGER DEFAULT 0
);

-- Index for fast room code lookups
CREATE INDEX IF NOT EXISTS rooms_code_idx ON public.rooms (code);

-- =============================================
-- PARTICIPANTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,  -- Supabase auth user ID
  display_name TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  language_name TEXT NOT NULL DEFAULT 'English',
  is_connected BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one participant per user per room
CREATE UNIQUE INDEX IF NOT EXISTS participants_room_user_idx ON public.participants (room_id, user_id);

-- Index for fast room participant queries
CREATE INDEX IF NOT EXISTS participants_room_idx ON public.participants (room_id);

-- =============================================
-- MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,  -- Supabase auth user ID
  sender_name TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translation_status TEXT DEFAULT 'pending', -- 'pending', 'translated', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for room message queries sorted by time
CREATE INDEX IF NOT EXISTS messages_room_created_idx ON public.messages (room_id, created_at DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update room participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.rooms SET participant_count = participant_count + 1, updated_at = NOW()
    WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rooms SET participant_count = GREATEST(participant_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update participant count
DROP TRIGGER IF EXISTS on_participant_change ON public.participants;
CREATE TRIGGER on_participant_change
  AFTER INSERT OR DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();

-- Function to check room capacity before adding participant
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT participant_count INTO current_count FROM public.rooms WHERE id = NEW.room_id;
  IF current_count >= 2 THEN
    RAISE EXCEPTION 'Room is full. Maximum 2 participants allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce 2-participant limit
DROP TRIGGER IF EXISTS check_room_capacity_trigger ON public.participants;
CREATE TRIGGER check_room_capacity_trigger
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION check_room_capacity();

-- Function to update last_seen_at
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_participant_update ON public.participants;
CREATE TRIGGER on_participant_update
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION update_last_seen();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ROOMS POLICIES
-- Anyone can read rooms (needed for joining by code)
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (true);

-- Authenticated users can create rooms
CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Participants can update their room
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE room_id = id AND user_id = auth.uid()
    )
  );

-- Helper function to fetch room IDs without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_room_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT p.room_id FROM public.participants p WHERE p.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PARTICIPANTS POLICIES
-- Users can read participants in rooms they belong to
CREATE POLICY "participants_select" ON public.participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR room_id IN (SELECT public.get_my_room_ids())
  );

-- Authenticated users can join rooms (capacity enforced by trigger)
CREATE POLICY "participants_insert" ON public.participants
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- Users can update their own participant record
CREATE POLICY "participants_update" ON public.participants
  FOR UPDATE USING (user_id = auth.uid());

-- Users can leave rooms (delete their participant record)
CREATE POLICY "participants_delete" ON public.participants
  FOR DELETE USING (user_id = auth.uid());

-- MESSAGES POLICIES
-- Participants can read messages in rooms they belong to
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    room_id IN (SELECT public.get_my_room_ids())
  );

-- Participants can send messages to rooms they belong to
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND sender_id = auth.uid()
    AND room_id IN (SELECT public.get_my_room_ids())
  );

-- =============================================
-- REALTIME CONFIGURATION
-- =============================================
-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
