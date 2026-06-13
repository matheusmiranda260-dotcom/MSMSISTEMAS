
-- Create the downtime_configs table
CREATE TABLE IF NOT EXISTS public.downtime_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL,
    threshold_minutes INTEGER NOT NULL DEFAULT 15,
    machine_type TEXT NOT NULL DEFAULT 'Geral',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.downtime_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Enable read access for all users" ON public.downtime_configs
    FOR SELECT USING (true);

CREATE POLICY "Enable all access for authenticated users" ON public.downtime_configs
    FOR ALL USING (true);

