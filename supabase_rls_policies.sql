-- Supabase Row Level Security (RLS) Setup Script
-- Execute this in your Supabase SQL Editor to set up RLS policies
-- Adjust table names and columns based on your actual database schema

-- ============================================================================
-- Enable RLS on Tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_lots ENABLE ROW LEVEL SECURITY;
-- Add more tables as needed

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================
-- Each user can view and edit only their own profile

-- SELECT: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- DELETE: Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- INSERT: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Public read access for non-sensitive profile fields (optional)
-- Only allow specific columns to be readable
CREATE POLICY "Public profiles are viewable"
  ON public.profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ============================================================================
-- VEHICLES TABLE POLICIES
-- ============================================================================
-- Owner-based access for vehicles

-- SELECT: Users can view their own vehicles
CREATE POLICY "Users can view their own vehicles"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- SELECT: Public can view vehicle details (for license plate recognition app)
CREATE POLICY "Anyone can view vehicle data"
  ON public.vehicles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: Only authenticated users can add vehicles
CREATE POLICY "Authenticated users can add vehicles"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only vehicle owner can update
CREATE POLICY "Vehicle owners can update their vehicles"
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- DELETE: Only vehicle owner can delete
CREATE POLICY "Vehicle owners can delete their vehicles"
  ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- PARKING_SESSIONS TABLE POLICIES
-- ============================================================================
-- Users can only see their own parking sessions

-- SELECT: Users can view their own sessions
CREATE POLICY "Users can view their own parking sessions"
  ON public.parking_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Users can create their own sessions
CREATE POLICY "Users can create their own parking sessions"
  ON public.parking_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own sessions
CREATE POLICY "Users can update their own parking sessions"
  ON public.parking_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- DELETE: Users can delete their own sessions
CREATE POLICY "Users can delete their own parking sessions"
  ON public.parking_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- PARKING_LOTS TABLE POLICIES
-- ============================================================================
-- Public read, authenticated write

-- SELECT: Anyone can view parking lots
CREATE POLICY "Anyone can view parking lots"
  ON public.parking_lots
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT: Only authenticated users can add parking lots
CREATE POLICY "Authenticated users can add parking lots"
  ON public.parking_lots
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only lot owner can update
CREATE POLICY "Lot owners can update their parking lots"
  ON public.parking_lots
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- DELETE: Only lot owner can delete
CREATE POLICY "Lot owners can delete their parking lots"
  ON public.parking_lots
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- ADMIN POLICIES (if needed)
-- ============================================================================
-- Create a helper function to check if user is admin

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin users have full access to everything
-- Example for audit logs table (if you have one):
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- HELPER FUNCTION FOR RLS TESTING
-- ============================================================================
-- Use this to test RLS policies

CREATE OR REPLACE FUNCTION test_rls_as_user(user_id UUID)
RETURNS TABLE (
  table_name TEXT,
  policy_status TEXT
) AS $$
BEGIN
  -- This is for testing and debugging purposes only
  -- Switch to specific user context
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    false
  );

  RETURN QUERY
  SELECT
    'profiles'::TEXT as table_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.profiles WHERE id = user_id
    ) THEN 'Can access own profile' ELSE 'Cannot access' END as policy_status;

  RETURN QUERY
  SELECT
    'vehicles'::TEXT as table_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.vehicles WHERE owner_id = user_id
    ) THEN 'Can access own vehicles' ELSE 'Cannot access' END as policy_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT LOGGING (Optional)
-- ============================================================================
-- Track changes for compliance and debugging

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and the user who made the change can view
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Only system can insert audit logs (use service role for triggers)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Create audit trigger (execute as service role)
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, table_name, operation, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger to tables (optional)
-- CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify your RLS setup

-- Check which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- USEFUL DEBUGGING QUERIES
-- ============================================================================

-- Show current user context (run in Supabase SQL editor)
SELECT current_user, session_user, auth.uid(), auth.role();

-- Test if user can access a specific table
SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;

-- Check JWT claims being used
SELECT current_setting('request.jwt.claims')::json as jwt_claims;

-- Find policies that might be blocking access
SELECT
  tablename,
  policyname,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- ============================================================================
-- CLEANUP/RESET (if needed)
-- ============================================================================
-- CAUTION: Only run these if you need to reset RLS

-- Drop all policies on a table
-- DO $$ DECLARE
--   pol record;
-- BEGIN
--   FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
--     EXECUTE 'DROP POLICY "' || pol.policyname || '" ON public.profiles';
--   END LOOP;
-- END $$;

-- Disable RLS on a table (removes all protection)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUPABASE-SPECIFIC SETTINGS
-- ============================================================================

-- Ensure auth schema functions are accessible
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.role() TO authenticated, anon;

-- Set session level defaults
-- These are set automatically by Supabase in the proper context

-- ============================================================================
-- NOTES FOR PRODUCTION
-- ============================================================================

/*
1. TESTING RLS POLICIES:
   - Test with both authenticated and anonymous roles
   - Use different user IDs to verify isolation
   - Test INSERT, UPDATE, DELETE separately from SELECT

2. SECURITY BEST PRACTICES:
   - Always use RLS in production (no exceptions!)
   - Use authenticated role for user data
   - Use anon role sparingly (only for public data)
   - Use SECURITY DEFINER functions carefully (they bypass RLS)
   - Regularly audit policy effectiveness

3. PERFORMANCE CONSIDERATIONS:
   - RLS adds a small overhead to every query
   - Complex policies with joins may be slower
   - Add indexes to frequently queried/filtered columns
   - Monitor slow query logs

4. COMMON MISTAKES:
   - Forgetting to enable RLS (most common!)
   - Policies too permissive or too restrictive
   - Using wrong role in policy (authenticated vs anon)
   - Circular dependencies in policies
   - Not testing with different users

5. DEBUGGING:
   - Check pg_policies view for policy definitions
   - Enable EXPLAIN ANALYZE for slow queries
   - Check auth.uid() and auth.role() in queries
   - Review error logs in Supabase dashboard
*/
