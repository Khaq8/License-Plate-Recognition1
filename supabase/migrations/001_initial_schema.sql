-- ============================================================
-- License Plate Recognition System - Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE transaction_type AS ENUM ('payment', 'top_up', 'refund', 'penalty');
CREATE TYPE session_status AS ENUM ('active', 'completed');

-- ============================================================
-- TABLE: profiles (linked to Supabase Auth users)
-- This replaces the custom 'users' table and integrates with Supabase Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    credit_balance NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_is_admin ON public.profiles(is_admin);

-- ============================================================
-- TABLE: parking_lots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parking_lots (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (hourly_rate >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for active lots
CREATE INDEX idx_parking_lots_is_active ON public.parking_lots(is_active);
CREATE INDEX idx_parking_lots_city ON public.parking_lots(city);

-- ============================================================
-- TABLE: cars
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cars (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    license_plate TEXT UNIQUE NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_cars_user_id ON public.cars(user_id);
CREATE INDEX idx_cars_license_plate ON public.cars(license_plate);

-- ============================================================
-- TABLE: parking_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parking_sessions (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    car_id INTEGER REFERENCES public.cars(id) ON DELETE SET NULL,
    plate TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entry_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    exit_time TIMESTAMPTZ,
    entry_image_url TEXT,
    exit_image_url TEXT,
    entry_confidence REAL,
    exit_confidence REAL,
    duration_minutes INTEGER,
    amount_charged NUMERIC(10, 2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    is_force_checkout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_parking_sessions_lot_id ON public.parking_sessions(lot_id);
CREATE INDEX idx_parking_sessions_car_id ON public.parking_sessions(car_id);
CREATE INDEX idx_parking_sessions_user_id ON public.parking_sessions(user_id);
CREATE INDEX idx_parking_sessions_plate ON public.parking_sessions(plate);
CREATE INDEX idx_parking_sessions_status ON public.parking_sessions(status);
CREATE INDEX idx_parking_sessions_exit_time ON public.parking_sessions(exit_time);
CREATE INDEX idx_parking_sessions_active ON public.parking_sessions(lot_id, status) WHERE status = 'active';

-- ============================================================
-- TABLE: transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES public.parking_sessions(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('payment', 'top_up', 'refund', 'penalty')),
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_session_id ON public.transactions(session_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON public.transactions(type);

-- ============================================================
-- TABLE: plate_detections (ALPR detection logs)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plate_detections (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    plate TEXT,
    ocr_confidence REAL,
    detection_confidence REAL,
    lot_id INTEGER REFERENCES public.parking_lots(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_plate_detections_session_id ON public.plate_detections(session_id);
CREATE INDEX idx_plate_detections_plate ON public.plate_detections(plate);
CREATE INDEX idx_plate_detections_lot_id ON public.plate_detections(lot_id);
CREATE INDEX idx_plate_detections_timestamp ON public.plate_detections(timestamp DESC);

-- ============================================================
-- TABLE: gov_plate_numb (Government plate mapping)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gov_plate_numb (
    id SERIAL PRIMARY KEY,
    gov_plate_numb TEXT,
    plate TEXT,
    detection_id INTEGER REFERENCES public.plate_detections(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_gov_plate_numb_gov_plate ON public.gov_plate_numb(gov_plate_numb);
CREATE INDEX idx_gov_plate_numb_plate ON public.gov_plate_numb(plate);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's ID
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNCTION: Auto-create profile on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plate_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_plate_numb ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: profiles
-- ============================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: parking_lots
-- ============================================================

-- Anyone authenticated can view active parking lots
CREATE POLICY "Authenticated users can view active lots"
    ON public.parking_lots FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- Admins can view all lots (including inactive)
CREATE POLICY "Admins can view all lots"
    ON public.parking_lots FOR SELECT
    USING (public.is_admin());

-- Only admins can create lots
CREATE POLICY "Admins can create lots"
    ON public.parking_lots FOR INSERT
    WITH CHECK (public.is_admin());

-- Only admins can update lots
CREATE POLICY "Admins can update lots"
    ON public.parking_lots FOR UPDATE
    USING (public.is_admin());

-- Only admins can delete lots
CREATE POLICY "Admins can delete lots"
    ON public.parking_lots FOR DELETE
    USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: cars
-- ============================================================

-- Users can view their own cars
CREATE POLICY "Users can view own cars"
    ON public.cars FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all cars
CREATE POLICY "Admins can view all cars"
    ON public.cars FOR SELECT
    USING (public.is_admin());

-- Users can insert their own cars
CREATE POLICY "Users can create own cars"
    ON public.cars FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own cars
CREATE POLICY "Users can update own cars"
    ON public.cars FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own cars
CREATE POLICY "Users can delete own cars"
    ON public.cars FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can manage all cars
CREATE POLICY "Admins can manage all cars"
    ON public.cars FOR ALL
    USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: parking_sessions
-- ============================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.parking_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
    ON public.parking_sessions FOR SELECT
    USING (public.is_admin());

-- Only admins can create sessions (via ALPR system)
CREATE POLICY "Admins can create sessions"
    ON public.parking_sessions FOR INSERT
    WITH CHECK (public.is_admin());

-- Only admins can update sessions
CREATE POLICY "Admins can update sessions"
    ON public.parking_sessions FOR UPDATE
    USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: transactions
-- ============================================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
    ON public.transactions FOR SELECT
    USING (public.is_admin());

-- Only admins can create transactions
CREATE POLICY "Admins can create transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (public.is_admin());

-- ============================================================
-- RLS POLICIES: plate_detections (ALPR logs)
-- ============================================================

-- Only admins can access plate detections
CREATE POLICY "Admins can manage plate detections"
    ON public.plate_detections FOR ALL
    USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: gov_plate_numb
-- ============================================================

-- Only admins can access government plate data
CREATE POLICY "Admins can manage gov plates"
    ON public.gov_plate_numb FOR ALL
    USING (public.is_admin());

-- ============================================================
-- VIEWS for common queries
-- ============================================================

-- View for active sessions count per lot
CREATE OR REPLACE VIEW public.lot_occupancy AS
SELECT
    pl.id AS lot_id,
    pl.name,
    pl.capacity,
    COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS current_occupancy,
    pl.capacity - COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS available_spots,
    ROUND((COUNT(ps.id) FILTER (WHERE ps.status = 'active')::NUMERIC / pl.capacity) * 100, 2) AS occupancy_percentage
FROM public.parking_lots pl
LEFT JOIN public.parking_sessions ps ON pl.id = ps.lot_id
WHERE pl.is_active = TRUE
GROUP BY pl.id, pl.name, pl.capacity;

-- ============================================================
-- SAMPLE DATA (Optional - Remove in production)
-- ============================================================

-- Insert a sample admin user (run this after a user signs up to make them admin)
-- UPDATE public.profiles SET is_admin = TRUE WHERE email = 'admin@example.com';

-- ============================================================
-- GRANTS (Allow authenticated users to use functions)
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Service role has full access
GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================
-- REALTIME (Enable for live updates)
-- ============================================================

-- Enable realtime for parking sessions (useful for live occupancy updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_lots;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Verify tables created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
