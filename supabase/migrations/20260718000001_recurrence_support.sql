-- Migration: Add recurrence support columns to tasks and events
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS parent_recurring_id UUID;

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS parent_recurring_id UUID;
