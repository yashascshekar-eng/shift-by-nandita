-- Curd is logged by weight (per 100 g) instead of per cup. "1 cup curd" on WhatsApp now means 200 g.
update public.foods set serving_qty = 100, unit = 'g', kcal = 61, p = 3.5, c = 4.7, f = 3.3
where name = 'Curd' and owner_client_id is null;
