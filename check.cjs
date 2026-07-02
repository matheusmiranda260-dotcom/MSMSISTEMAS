const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function run() {
  const { data, error } = await supabase.from('production_orders')
    .select('id, order_number, status, sub_items_progress')
    .eq('order_number', '0000002-8');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}
run();
