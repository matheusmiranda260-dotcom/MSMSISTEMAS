const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await supabase.from('production_orders').select('id, order_number, sub_items_progress').eq('order_number', '0000001-10');
    if (error) console.error(error);
    else console.log(JSON.stringify(data[0].sub_items_progress, null, 2));
}
run();
