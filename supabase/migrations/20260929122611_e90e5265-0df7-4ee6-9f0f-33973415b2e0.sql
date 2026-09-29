INSERT INTO public.listings (id, title, title_ar, creator_id, category, price, status) VALUES
('pharaoh-procession','Procession of the Pharaoh','موكب الفرعون','karim-mansour','Heritage',45,'published'),
('nefertiti-replica','Nefertiti Bust (Museum Replica)','تمثال نفرتيتي (نسخة متحفية)','karim-mansour','Heritage',1250,'published'),
('giza-dawn','Giza at Dawn','الجيزة عند الفجر','karim-mansour','Painting',45,'published'),
('anubis-jar','Anubis Canopic Jar','جرّة أنوبيس الكانوبية','karim-mansour','Heritage',390,'published'),
('khayamiya-star','Khayamiya Star','نجمة الخيامية','karim-mansour','Heritage',720,'published'),
('najdi-door','Najdi Door, Diriyah','باب نجدي، الدرعية','hessa-alqahtani','Photography',35,'published'),
('dallah-majlis','Dallah of the Majlis','دلّة المجلس','hessa-alqahtani','Heritage',560,'published'),
('pearling-dhow','The Pearling Dhow','سفينة الغوص','hessa-alqahtani','Painting',60,'published'),
('omani-khanjar','Silver Khanjar & Pearls','خنجر فضي ولؤلؤ','hessa-alqahtani','Heritage',1650,'published'),
('hegra-golden-hour','Hegra, Golden Hour','الحِجر في الساعة الذهبية','hessa-alqahtani','Photography',50,'published')
ON CONFLICT (id) DO NOTHING;