insert into public.documents (unit_id, category, title, file_path, issued_date, is_published) values
('282451dd-bae1-48c0-8793-4bf20bd6ad87','management_agreement','Management Agreement № 064/UMA-TUS/XI/2025','282451dd-bae1-48c0-8793-4bf20bd6ad87/MA-B316-YURY-GROSHEV-14.11.2025.pdf','2025-11-14',true),
('282451dd-bae1-48c0-8793-4bf20bd6ad87','bast','BAST Unit B316','282451dd-bae1-48c0-8793-4bf20bd6ad87/BAST-Unit-B316.pdf',null,true),
('282451dd-bae1-48c0-8793-4bf20bd6ad87','lease_agreement','No. 01 — Akta Sewa Menyewa Unit B316','282451dd-bae1-48c0-8793-4bf20bd6ad87/Akta-Sewa-Menyewa-Unit-B316-03.06.2024.pdf','2024-06-03',true),
('282451dd-bae1-48c0-8793-4bf20bd6ad87','other','Docs B316 — signed package','282451dd-bae1-48c0-8793-4bf20bd6ad87/Docs-B316-Esign.pdf',null,true);

insert into public.reports (unit_id, report_type, period_label, period_start, period_end, file_path, net_payout, currency, is_published) values
('282451dd-bae1-48c0-8793-4bf20bd6ad87','roi','April – June 2026','2026-04-01','2026-06-30','282451dd-bae1-48c0-8793-4bf20bd6ad87/Owner_Statement_Apr-Jun_2026_B316.pdf',10197344,'IDR',true),
('282451dd-bae1-48c0-8793-4bf20bd6ad87','roi','July 2026','2026-07-01','2026-07-31','282451dd-bae1-48c0-8793-4bf20bd6ad87/Owner_Statement_Jul_2026_B316.pdf',5531905,'IDR',true);