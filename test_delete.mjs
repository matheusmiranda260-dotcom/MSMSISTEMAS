import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://uakwypgyajcxdvktoauc.supabase.co', 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');

async function run() {
    const res = await supabase.from('production_orders').delete().eq('order_number', '0000003 - 8 - XXXX');
    console.log(res);
}
run();
