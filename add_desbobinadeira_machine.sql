-- Script para adicionar a máquina 'Desbobinadeira 1' à constraint de máquinas da tabela production_orders
-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;

ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_machine_check 
    CHECK (machine IN ('Trefila', 'Treliça', 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2', 'Desbobinadeira 1'));

-- Verificação: listar as constraints atuais para confirmar a alteração
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.production_orders'::regclass 
AND contype = 'c';
