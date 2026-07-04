import { db } from './db.js';
db.all("SELECT id, gauge, commercial_name, material_type, purchase_price, raw_weight_value, weight_per_meter FROM stock_gauges WHERE commercial_name LIKE '%ARAME%'", (err, rows) => {
    console.log(rows);
    process.exit(0);
});
