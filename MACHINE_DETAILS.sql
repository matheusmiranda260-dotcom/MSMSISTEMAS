CREATE TABLE IF NOT EXISTS machine_technical_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_name TEXT NOT NULL UNIQUE,
    installation_date DATE,
    model TEXT,
    serial_number TEXT,
    manufacturer TEXT,
    parts_manual_url TEXT,
    instruction_manual_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_machine_technical_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_machine_technical_details_updated_at ON machine_technical_details;

CREATE TRIGGER trg_machine_technical_details_updated_at
BEFORE UPDATE ON machine_technical_details
FOR EACH ROW
EXECUTE FUNCTION update_machine_technical_details_updated_at();
