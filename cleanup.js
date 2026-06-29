const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length > 1) {
        acc[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    }
    return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: po } = await supabase.from('production_orders').select('id, order_number');
  const { data: co } = await supabase.from('commercial_orders').select('orderNumber');
  if(!po || !co) { console.log('Error fetching'); return; }
  const coSet = new Set(co.map(c => c.orderNumber));
  let orphans = 0;
  for (const p of po) {
    if (p.order_number) {
       const base = p.order_number.split('-')[0];
       if (!coSet.has(base)) {
           await supabase.from('production_orders').delete().eq('id', p.id);
           orphans++;
       }
    }
  }
  console.log('Orphans deleted:', orphans);
}
run();
