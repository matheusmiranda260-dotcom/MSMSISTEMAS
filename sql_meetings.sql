-- Create Meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    author TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Create Policy for open access (as per existing project pattern)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.meetings;
CREATE POLICY "Enable all access for all users" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

