
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage units
CREATE TABLE public.storage_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  crop_type TEXT NOT NULL,
  capacity_kg NUMERIC,
  current_stock_kg NUMERIC DEFAULT 0,
  device_id TEXT UNIQUE,
  device_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  min_temp NUMERIC NOT NULL DEFAULT 5,
  max_temp NUMERIC NOT NULL DEFAULT 25,
  min_humidity NUMERIC NOT NULL DEFAULT 40,
  max_humidity NUMERIC NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_units TO authenticated;
GRANT ALL ON public.storage_units TO service_role;
ALTER TABLE public.storage_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own units select" ON public.storage_units FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own units insert" ON public.storage_units FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own units update" ON public.storage_units FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own units delete" ON public.storage_units FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sensor readings
CREATE TABLE public.sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  storage_unit_id UUID NOT NULL REFERENCES public.storage_units(id) ON DELETE CASCADE,
  temperature NUMERIC NOT NULL,
  humidity NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_readings_unit_time ON public.sensor_readings(storage_unit_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_readings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sensor_readings_id_seq TO authenticated;
GRANT ALL ON public.sensor_readings TO service_role;
GRANT ALL ON SEQUENCE public.sensor_readings_id_seq TO service_role;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own readings select" ON public.sensor_readings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.storage_units u WHERE u.id = storage_unit_id AND u.user_id = auth.uid()));

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_unit_id UUID NOT NULL REFERENCES public.storage_units(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_user_time ON public.alerts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts select" ON public.alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own alerts update" ON public.alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Market prices (public read for authed users)
CREATE TABLE public.market_prices (
  id BIGSERIAL PRIMARY KEY,
  crop_type TEXT NOT NULL,
  market_name TEXT NOT NULL,
  price_per_kg NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_prices_crop_time ON public.market_prices(crop_type, recorded_at DESC);
GRANT SELECT ON public.market_prices TO authenticated;
GRANT ALL ON public.market_prices TO service_role;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads prices" ON public.market_prices FOR SELECT TO authenticated USING (true);

-- Seed market prices: last 30 days for common crops
INSERT INTO public.market_prices (crop_type, market_name, price_per_kg, recorded_at)
SELECT crop, 'Central Wholesale', base + (random()*0.4 - 0.2) + (d::numeric/200), CURRENT_DATE - d
FROM (VALUES ('Wheat',0.32),('Rice',0.55),('Maize',0.28),('Potato',0.42),('Onion',0.38),('Tomato',0.85)) AS c(crop, base),
generate_series(0, 29) AS d;
