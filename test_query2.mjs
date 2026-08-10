import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://uakwypgyajcxdvktoauc.supabase.co', 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');

async function test() {
  const { data, error } = await supabase.from('production_orders')
    .select('target_bitola, summary, machine')
    .eq('machine', 'Schnell-PRIMA')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Last 5 orders for Schnell-PRIMA:', JSON.stringify({ data, error }, null, 2));
}
test();
