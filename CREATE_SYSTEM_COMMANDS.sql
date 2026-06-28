CREATE TABLE IF NOT EXISTS public.system_commands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  command_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE system_commands;
