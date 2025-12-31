-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cars (
  id integer NOT NULL DEFAULT nextval('cars_id_seq'::regclass),
  user_id uuid NOT NULL,
  license_plate text NOT NULL,
  brand text,
  model text,
  color text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  owner_priority smallint NOT NULL DEFAULT 1 CHECK (owner_priority >= 1 AND owner_priority <= 3),
  CONSTRAINT cars_pkey PRIMARY KEY (id),
  CONSTRAINT cars_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.gov_plate_numb (
  id integer NOT NULL DEFAULT nextval('gov_plate_numb_id_seq'::regclass),
  gov_plate_numb text,
  plate text,
  detection_id integer,
  CONSTRAINT gov_plate_numb_pkey PRIMARY KEY (id),
  CONSTRAINT gov_plate_numb_detection_id_fkey FOREIGN KEY (detection_id) REFERENCES public.plate_detections(id)
);
CREATE TABLE public.parking_lots (
  id integer NOT NULL DEFAULT nextval('parking_lots_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  address text,
  city text,
  capacity integer NOT NULL CHECK (capacity > 0),
  hourly_rate numeric NOT NULL DEFAULT 1.00 CHECK (hourly_rate >= 0::numeric),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  latitude numeric,
  longitude numeric,
  CONSTRAINT parking_lots_pkey PRIMARY KEY (id)
);
CREATE TABLE public.parking_sessions (
  id integer NOT NULL DEFAULT nextval('parking_sessions_id_seq'::regclass),
  lot_id integer NOT NULL,
  car_id integer,
  plate text NOT NULL,
  user_id uuid,
  entry_time timestamp with time zone NOT NULL DEFAULT now(),
  exit_time timestamp with time zone,
  entry_image_url text,
  exit_image_url text,
  entry_confidence real,
  exit_confidence real,
  duration_minutes integer,
  amount_charged numeric,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text])),
  is_force_checkout boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parking_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT parking_sessions_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.parking_lots(id),
  CONSTRAINT parking_sessions_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id),
  CONSTRAINT parking_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.plate_detections (
  id integer NOT NULL DEFAULT nextval('plate_detections_id_seq'::regclass),
  session_id text,
  timestamp timestamp with time zone DEFAULT now(),
  plate text,
  ocr_confidence real,
  detection_confidence real,
  lot_id integer,
  CONSTRAINT plate_detections_pkey PRIMARY KEY (id),
  CONSTRAINT plate_detections_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.parking_lots(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  email text UNIQUE,
  phone text,
  is_admin boolean DEFAULT false,
  credit_balance numeric DEFAULT 0.00,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.transactions (
  id integer NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  user_id uuid NOT NULL,
  session_id integer,
  type text NOT NULL CHECK (type = ANY (ARRAY['payment'::text, 'top_up'::text, 'refund'::text, 'penalty'::text])),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.parking_sessions(id)
);