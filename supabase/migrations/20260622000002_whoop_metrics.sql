-- Add new WHOOP metrics columns and wake_time for sleep-based day rollover
ALTER TABLE whoop_data
  ADD COLUMN IF NOT EXISTS wake_time       timestamptz,
  ADD COLUMN IF NOT EXISTS resting_hr      numeric,
  ADD COLUMN IF NOT EXISTS spo2            numeric,
  ADD COLUMN IF NOT EXISTS skin_temp_delta numeric,
  ADD COLUMN IF NOT EXISTS sleep_efficiency numeric,
  ADD COLUMN IF NOT EXISTS deep_sleep_min  numeric,
  ADD COLUMN IF NOT EXISTS rem_sleep_min   numeric,
  ADD COLUMN IF NOT EXISTS total_sleep_min numeric,
  ADD COLUMN IF NOT EXISTS sleep_needed_min numeric;
