-- İş/okul konumu. lat/lon/place_label artık "ev" konumu.
-- Boşsa kişi evden çalışıyor sayılır; gün içi hava da ev konumundan hesaplanır.
ALTER TABLE users ADD COLUMN work_lat REAL;
ALTER TABLE users ADD COLUMN work_lon REAL;
ALTER TABLE users ADD COLUMN work_label TEXT;
