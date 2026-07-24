const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('machine_current_states').upsert({
        machine_name: 'TEST',
        status: 'ATIVA'
    });
    console.log('Data:', data);
    console.log('Error:', error);
}

run();
