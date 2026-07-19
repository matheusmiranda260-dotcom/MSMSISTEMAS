-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.machine_maintenance_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    maintenance_id UUID REFERENCES public.machine_maintenance(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Em Andamento, Resolvido
    before_image_url TEXT,
    after_image_url TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permissões gerais
ALTER TABLE public.machine_maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.machine_maintenance_tasks FOR SELECT USING (true);
CREATE POLICY "Permitir inserção" ON public.machine_maintenance_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização" ON public.machine_maintenance_tasks FOR UPDATE USING (true);
CREATE POLICY "Permitir deleção" ON public.machine_maintenance_tasks FOR DELETE USING (true);
