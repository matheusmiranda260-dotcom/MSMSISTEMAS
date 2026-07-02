const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function run() {
  const { data, error } = await supabase.from('app_users').select('username, is_online, assigned_machines');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
