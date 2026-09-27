ALTER TABLE public.digital_assets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Logos',
  ADD COLUMN IF NOT EXISTS category_ar text NOT NULL DEFAULT 'شعارات',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'logo';
UPDATE public.digital_assets SET tags = ARRAY['bank','saudi','logo','finance'] WHERE collection = 'saudi-banks' AND tags = '{}';
INSERT INTO public.digital_assets (id, collection, name, name_ar, code, color, founded, category, category_ar, tags, description, description_ar, preview_url, kind, sort) VALUES
 ('img-gallery-hall','arwiqa-images','Gallery hall','قاعة العرض','GAL','#8a5a3b',2026,'Photography','تصوير فوتوغرافي',ARRAY['gallery','interior','exhibition'],'Wide view of a contemporary gallery hall.','منظر واسع لقاعة عرض معاصرة.','/digital/gallery-wide.jpg','image',100),
 ('img-majlis','arwiqa-images','Majlis interior','مجلس','MAJ','#6b4a2f',2026,'Interiors','تصاميم داخلية',ARRAY['majlis','saudi','interior','heritage'],'Traditional Saudi majlis with art on the wall.','مجلس سعودي تقليدي بلوحة على الجدار.','/digital/space-majlis.jpg','image',101),
 ('img-living','arwiqa-images','Living room','غرفة معيشة','LIV','#9b7b5a',2026,'Interiors','تصاميم داخلية',ARRAY['home','interior','mockup'],'Modern living room mockup for artworks.','نموذج غرفة معيشة حديثة لعرض الأعمال.','/digital/space-living.jpg','image',102),
 ('img-office','arwiqa-images','Office space','مساحة مكتبية','OFF','#5a5a5a',2026,'Interiors','تصاميم داخلية',ARRAY['office','interior','mockup'],'Office wall mockup.','نموذج جدار مكتب.','/digital/space-office.jpg','image',103),
 ('img-art-1','arwiqa-images','Abstract study I','دراسة تجريدية ١','AB1','#b0643c',2026,'Artwork','أعمال فنية',ARRAY['abstract','painting','warm'],'Warm abstract artwork.','عمل تجريدي بألوان دافئة.','/digital/art1.jpg','image',104),
 ('img-art-2','arwiqa-images','Abstract study II','دراسة تجريدية ٢','AB2','#3f5d4a',2026,'Artwork','أعمال فنية',ARRAY['abstract','painting','green'],'Abstract artwork in palm tones.','عمل تجريدي بألوان النخيل.','/digital/art2.jpg','image',105),
 ('img-art-3','arwiqa-images','Desert tones','ألوان الصحراء','DES','#c49a5a',2026,'Artwork','أعمال فنية',ARRAY['desert','sand','painting'],'Artwork inspired by desert sand.','عمل مستوحى من رمال الصحراء.','/digital/art3.jpg','image',106),
 ('img-studio','arwiqa-images','Artist studio','مرسم الفنان','STU','#7a6a55',2026,'Photography','تصوير فوتوغرافي',ARRAY['studio','artist','behind-the-scenes'],'An artist at work in the studio.','فنان يعمل في مرسمه.','/digital/artist-studio.jpg','image',107)
ON CONFLICT (id) DO NOTHING;