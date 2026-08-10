import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://uakwypgyajcxdvktoauc.supabase.co', 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');

async function test() {
  const newOrder = {
    order_number: "0000003 - 8 - XXXX",
    machine: "Schnell-PRIMA",
    target_bitola: "8",
    selected_lot_ids: [],
    total_weight: 100,
    total_meters: 100,
    is_ghost_order: true,
    input_bitola: "",
    status: "in_progress",
    creation_date: "2026-08-05T12:00:00Z",
    related_commercial_order_id: "2cf7011e-d155-4dc7-acf8-598f4174123e",
    quantity_os: 1,
    summary: { osList: ["123"] }
  };
    
  const { data, error } = await supabase.from('production_orders')
    .insert([newOrder]).select();
    
  console.log('Insert result:', JSON.stringify({ data, error }, null, 2));
}
test();
