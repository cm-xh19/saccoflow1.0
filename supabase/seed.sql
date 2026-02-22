-- Example Seed Script

-- 1. Create a Sacco
INSERT INTO saccos (id, name, email, location, status) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Seed Sacco', 'seed@sacco.com', 'Kampala', 'active') 
ON CONFLICT DO NOTHING;

-- NOTE: To properly seed users, you must create them via Supabase Auth API so auth.users is populated, 
-- which triggers the profiles table insertion. 
-- For local testing, if you insert into auth.users directly, make sure to bypass or handle the trigger, 
-- or use the Supabase CLI/Dashboard to create the users, and then tie the auth.uid() below.
-- 
-- Example data assuming profiles and auth.users are already set up:
-- 
-- INSERT INTO members (id, sacco_id, profile_id, name, email, status) VALUES ...
-- INSERT INTO transactions ...
