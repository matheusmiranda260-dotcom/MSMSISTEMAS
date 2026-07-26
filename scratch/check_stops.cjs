const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const url = envVars['VITE_SUPABASE_URL'];
const key = envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('machine_stops').select('*').order('start_time', { ascending: false }).limit(5);
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

run();
