INSERT INTO sources (id, name, description) VALUES ('c5aab739-7112-4360-be9e-45edf4287c42', 'Основной источник', 'Основной источник документов для AI-ассистента') ON CONFLICT (id) DO NOTHING;
