const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = fs.readFileSync('ADD_IMPORTANT_OBS_COLUMN.sql', 'utf8');
  console.log('Running SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
