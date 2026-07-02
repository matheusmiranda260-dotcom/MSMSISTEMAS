-- Adiciona coluna para registrar o início do turno do operador
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS current_shift_start TIMESTAMP WITH TIME ZONE;
