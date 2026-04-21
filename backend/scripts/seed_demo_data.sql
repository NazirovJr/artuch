-- Artuch Travel — demo data seed (SQL, идемпотентный).
--
-- Маркеры для последующей очистки:
--   reservations.notes LIKE 'DEMO:%'
--   transactions.employee = 'DEMO-Seed'
--   cleaning_tasks.notes LIKE 'DEMO:%'
--   guests.email = 'demo@artuch.local'
--
-- Запуск:
--   docker cp seed_demo_data.sql artuch-db:/tmp/seed.sql
--   docker exec -i artuch-db psql -U artuch -d artuch -f /tmp/seed.sql

BEGIN;

-- ── очистка прошлых демо-прогонов ──────────────────────────────────
DELETE FROM transaction_items WHERE "transactionId" IN (
  SELECT id FROM transactions WHERE employee = 'DEMO-Seed'
);
DELETE FROM transactions WHERE employee = 'DEMO-Seed';
DELETE FROM cleaning_tasks WHERE notes LIKE 'DEMO:%';
DELETE FROM reservations WHERE notes LIKE 'DEMO:%';
DELETE FROM guests WHERE email = 'demo@artuch.local';

-- ── 1. Гости (80 человек, реальные имена) ──────────────────────────
WITH
first_names AS (
  SELECT unnest(ARRAY[
    'Шерали','Фаррух','Диловар','Рустам','Хуршед','Сино','Сафар','Амирхон',
    'Далер','Камол','Махмуд','Манучехр','Насим','Ориф','Парвиз','Рамазон',
    'Саид','Темур','Умед','Хасан','Шухрат',
    'Азиза','Гулнора','Дилноза','Зарина','Лола','Манижа','Мохира','Нигина',
    'Озода','Парвина','Рухшона','Сабрина','Саида','Фариза',
    'Александр','Дмитрий','Иван','Сергей','Андрей','Михаил',
    'Анна','Мария','Екатерина','Ольга','Наталья','Татьяна'
  ]) AS fn
),
last_names AS (
  SELECT unnest(ARRAY[
    'Рахимов','Саидов','Назаров','Кодиров','Юсупов','Каримов','Раджабов',
    'Холов','Исмоилов','Иброхимов','Турсунов','Шарипов',
    'Рахимова','Саидова','Назарова','Юсупова','Исмоилова','Шарипова',
    'Иванов','Петров','Смирнов','Кузнецов','Попов','Соколов',
    'Иванова','Петрова','Смирнова','Кузнецова','Попова','Соколова'
  ]) AS ln
)
INSERT INTO guests (id, "firstName", "lastName", phone, email, nationality, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  (SELECT fn FROM first_names ORDER BY random() LIMIT 1),
  (SELECT ln FROM last_names ORDER BY random() LIMIT 1),
  '+992 9' || (90 + (random()*9)::int) || ' ' ||
    lpad((100 + (random()*899)::int)::text, 3, '0') || ' ' ||
    lpad((10 + (random()*89)::int)::text, 2, '0') || ' ' ||
    lpad((10 + (random()*89)::int)::text, 2, '0'),
  'demo@artuch.local',
  CASE WHEN random() < 0.7 THEN 'Таджикистан' ELSE 'Россия' END,
  now(),
  now()
FROM generate_series(1, 80);

-- ── 2. Reservations: 45 прошедших + 6 текущих + 35 предстоящих ─────

-- 2a. Прошедшие брони за 60 дней (checked-out) — для графика выручки.
INSERT INTO reservations
  (id, "guestId", "roomNumber", "checkInDate", "checkOutDate",
   "numberOfGuests", status, "totalPrice", notes, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  (SELECT id FROM guests WHERE email = 'demo@artuch.local' ORDER BY random() LIMIT 1),
  (SELECT number FROM rooms ORDER BY random() LIMIT 1),
  (CURRENT_DATE - ((3 + (random()*57)::int) || ' days')::interval)::date,
  (CURRENT_DATE - ((3 + (random()*57)::int) || ' days')::interval
     + ((2 + (random()*5)::int) || ' days')::interval)::date,
  1 + (random()*2)::int,
  'checked-out',
  (180 + (random()*140)::int) * (2 + (random()*5)::int),
  'DEMO: Трек — ' || (ARRAY[
    'Озеро Искандеркуль — 3 дня',
    'Озёра Алаудин — 5 дней',
    'Кулликалонские озёра — 4 дня',
    'Большое Алло — 6 дней',
    'Мутные озёра + Чукурак — 2 дня',
    'Панорама Фанов — 7 дней',
    'Чимтарга 5489м — 8 дней'
  ])[1 + (random()*6)::int],
  now() - INTERVAL '60 days',
  now()
FROM generate_series(1, 45);

-- 2b. Сейчас заехавшие (checked-in) — 6 штук.
INSERT INTO reservations
  (id, "guestId", "roomNumber", "checkInDate", "checkOutDate",
   "numberOfGuests", status, "totalPrice", notes, "createdAt", "updatedAt",
   "actualCheckIn")
SELECT
  gen_random_uuid(),
  (SELECT id FROM guests WHERE email = 'demo@artuch.local' ORDER BY random() LIMIT 1),
  (SELECT number FROM rooms ORDER BY random() LIMIT 1),
  (CURRENT_DATE - ((1 + (random()*2)::int) || ' days')::interval)::date,
  (CURRENT_DATE + ((2 + (random()*4)::int) || ' days')::interval)::date,
  1 + (random()*3)::int,
  'checked-in',
  (180 + (random()*140)::int) * (3 + (random()*4)::int),
  'DEMO: Трек — ' || (ARRAY[
    'Озеро Искандеркуль — 3 дня',
    'Озёра Алаудин — 5 дней',
    'Большое Алло — 6 дней',
    'Панорама Фанов — 7 дней'
  ])[1 + (random()*3)::int],
  now() - INTERVAL '7 days',
  now(),
  now() - INTERVAL '1 day'
FROM generate_series(1, 6);

-- 2c. Предстоящие (confirmed/pending) — 35 штук на ближайший месяц.
INSERT INTO reservations
  (id, "guestId", "roomNumber", "checkInDate", "checkOutDate",
   "numberOfGuests", status, "totalPrice", notes, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  (SELECT id FROM guests WHERE email = 'demo@artuch.local' ORDER BY random() LIMIT 1),
  (SELECT number FROM rooms ORDER BY random() LIMIT 1),
  (CURRENT_DATE + ((1 + (random()*28)::int) || ' days')::interval)::date,
  (CURRENT_DATE + ((1 + (random()*28)::int) || ' days')::interval
     + ((2 + (random()*5)::int) || ' days')::interval)::date,
  1 + (random()*3)::int,
  CASE WHEN random() > 0.3 THEN 'confirmed' ELSE 'pending' END,
  (180 + (random()*140)::int) * (2 + (random()*5)::int),
  'DEMO: Трек — ' || (ARRAY[
    'Озеро Искандеркуль — 3 дня',
    'Озёра Алаудин — 5 дней',
    'Кулликалонские озёра — 4 дня',
    'Большое Алло — 6 дней',
    'Мутные озёра + Чукурак — 2 дня',
    'Панорама Фанов — 7 дней',
    'Чимтарга 5489м — 8 дней'
  ])[1 + (random()*6)::int],
  now() - INTERVAL '7 days',
  now()
FROM generate_series(1, 35);

-- ── 3. POS-транзакции (600 штук за 60 дней) ────────────────────────
-- Пики на обед/ужин, 75% карта, флаг employee='DEMO-Seed'.
INSERT INTO transactions
  (id, type, "employeeId", employee, total, "paymentMethod",
   "outletId", status, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'sale',
  (SELECT id FROM users WHERE role IN ('cashier','barman','shop-seller','bartender','waiter','admin','owner','manager') ORDER BY random() LIMIT 1),
  'DEMO-Seed',
  0,  -- пересчитаем после вставки items
  CASE WHEN random() < 0.75 THEN 'card' ELSE 'cash' END,
  (SELECT id FROM outlets ORDER BY random() LIMIT 1),
  'completed',
  -- равномерно по 60 дням + часовой пик
  (CURRENT_DATE - ((random()*60)::int || ' days')::interval)
    + ((ARRAY[9,10,11,12,12,12,13,13,13,14,14,15,16,17,18,19,19,19,20,20,20,21,21,22])[1 + (random()*23)::int] || ' hours')::interval
    + ((random()*59)::int || ' minutes')::interval,
  now()
FROM generate_series(1, 600);

-- ── 4. Позиции каждой транзакции (1-3 позиции на чек) ──────────────
INSERT INTO transaction_items (id, "transactionId", name, price, quantity)
SELECT
  gen_random_uuid(),
  t.id,
  m.name,
  m.price,
  1 + (random()*2)::int
FROM transactions t
CROSS JOIN LATERAL (
  SELECT name, price
  FROM (VALUES
    ('Шурбо из баранины', 35),
    ('Лагман домашний', 40),
    ('Мастава', 30),
    ('Плов по-душанбински', 55),
    ('Шашлык из баранины', 65),
    ('Шашлык из курицы', 50),
    ('Манты (6 шт)', 45),
    ('Самбуса (3 шт)', 25),
    ('Курутоб', 40),
    ('Чай чёрный', 15),
    ('Чай зелёный', 15),
    ('Компот из урюка', 12),
    ('Айран', 10),
    ('Минеральная вода', 8),
    ('Лепёшка', 5),
    ('Халва тахинная', 20),
    ('Вода 1.5л', 12),
    ('Кока-кола', 10),
    ('Сникерс', 8),
    ('Шоколад', 22),
    ('Орехи кешью 100г', 35),
    ('Курага 500г', 45),
    ('Чай Ахмад', 65),
    ('Фонарик налобный', 120),
    ('Крем SPF50', 85)
  ) AS v(name, price)
  ORDER BY random()
  LIMIT 1 + (random()*2)::int
) m
WHERE t.employee = 'DEMO-Seed';

-- пересчитать total по реальной сумме items
UPDATE transactions t
SET total = sub.total
FROM (
  SELECT "transactionId", sum(price * quantity) AS total
  FROM transaction_items
  GROUP BY "transactionId"
) sub
WHERE t.id = sub."transactionId" AND t.employee = 'DEMO-Seed';

-- ── 5. Cleaning tasks для выездов сегодня + 6 случайных ────────────
-- Задача departure для каждого номера, откуда выезжают сегодня.
INSERT INTO cleaning_tasks
  (id, "roomNumber", type, status, "startedAt", "completedAt",
   notes, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  r."roomNumber",
  'departure',
  (ARRAY['pending','in-progress','review','done'])[1 + (random()*3)::int],
  CASE WHEN random() > 0.3 THEN CURRENT_DATE + INTERVAL '9 hours' ELSE NULL END,
  CASE WHEN random() > 0.6 THEN CURRENT_DATE + INTERVAL '11 hours' ELSE NULL END,
  'DEMO: авто-задача по выезду',
  now(),
  now()
FROM reservations r
WHERE r."checkOutDate" = CURRENT_DATE
  AND r.notes LIKE 'DEMO:%';

-- ещё 6 случайных задач для разнообразия статусов.
INSERT INTO cleaning_tasks
  (id, "roomNumber", type, status, "startedAt", "completedAt",
   notes, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  (SELECT number FROM rooms ORDER BY random() LIMIT 1),
  (ARRAY['stayover','departure','deep','inspection'])[1 + (random()*3)::int],
  (ARRAY['pending','in-progress','review','done'])[1 + (random()*3)::int],
  CURRENT_DATE + INTERVAL '9 hours',
  CASE WHEN random() > 0.5 THEN CURRENT_DATE + INTERVAL '11 hours' ELSE NULL END,
  'DEMO: демо-задача',
  now() - INTERVAL '1 day',
  now()
FROM generate_series(1, 6);

COMMIT;

-- ── Статистика ─────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM guests WHERE email = 'demo@artuch.local') AS demo_guests,
  (SELECT count(*) FROM reservations WHERE notes LIKE 'DEMO:%') AS demo_reservations,
  (SELECT count(*) FROM transactions WHERE employee = 'DEMO-Seed') AS demo_transactions,
  (SELECT count(*) FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.employee = 'DEMO-Seed') AS demo_transaction_items,
  (SELECT count(*) FROM cleaning_tasks WHERE notes LIKE 'DEMO:%') AS demo_cleaning_tasks;
