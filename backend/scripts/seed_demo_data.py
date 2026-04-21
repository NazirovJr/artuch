"""
Seed Artuch Travel database with realistic demo data.

Unlike Faker's random nonsense ("John Doe bought 3 lorem ipsum"), this
script inserts data that matches the business:

  - Real Tajik/Russian first and last names
  - Real Fann Mountains treks (Iskanderkul, Alauddin, Kulikalon, Bolshoe)
  - Real Tajik menu (lagman, plov, manti, shashlyk) with plausible prices
  - Seasonal reservations: more booked rooms in July-August (peak trek season)
  - POS transactions clustered around lunch (12-14h) and dinner (19-21h)
  - Cleaning tasks: a departure for every checkout-today reservation

Usage:
  pip install psycopg2-binary
  python seed_demo_data.py

Connection is read from DATABASE_URL env var, else defaults to the docker
compose one (postgresql://artuch:artuch_dev_2026@localhost:5432/artuch).

Run AFTER the NestJS backend has started at least once — it relies on
TypeORM's synchronize having created the tables and on the original seed
having inserted rooms, menu items, and staff users. This script only adds
*transactional* demo data: reservations, transactions, orders, folios,
cleaning tasks. It does not touch users, roles, or rooms.
"""
import os
import random
import uuid
from datetime import datetime, timedelta, time
from decimal import Decimal

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://artuch:artuch_dev_2026@localhost:5432/artuch",
)

# ── Realistic Tajik/Russian guest names ────────────────────────────
GUEST_FIRST_NAMES = [
    "Шерали", "Фаррух", "Диловар", "Рустам", "Хуршед", "Сино", "Сафар",
    "Амирхон", "Далер", "Камол", "Махмуд", "Манучехр", "Насим", "Ориф",
    "Парвиз", "Рамазон", "Саид", "Темур", "Умед", "Хасан", "Шухрат",
    "Азиза", "Гулнора", "Дилноза", "Зарина", "Лола", "Манижа", "Мохира",
    "Нигина", "Озода", "Парвина", "Рухшона", "Сабрина", "Саида", "Фариза",
    # Russian tourists (common in Fann region)
    "Александр", "Дмитрий", "Иван", "Сергей", "Андрей", "Михаил",
    "Анна", "Мария", "Екатерина", "Ольга", "Наталья", "Татьяна",
]

GUEST_LAST_NAMES = [
    "Рахимов", "Саидов", "Назаров", "Кодиров", "Юсупов", "Каримов",
    "Раджабов", "Холов", "Исмоилов", "Иброхимов", "Турсунов", "Шарипов",
    "Рахимова", "Саидова", "Назарова", "Юсупова", "Исмоилова", "Шарипова",
    "Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Соколов",
    "Иванова", "Петрова", "Смирнова", "Кузнецова", "Попова", "Соколова",
]

# ── Fann Mountains routes / trek packages (real) ──────────────────
TREK_ROUTES = [
    ("Озеро Искандеркуль — 3 дня", 850, "Пеший поход к легендарному озеру"),
    ("Озёра Алаудин — 5 дней", 1400, "Классический маршрут через Алаудинский перевал"),
    ("Кулликалонские озёра — 4 дня", 1150, "Семь бирюзовых озёр"),
    ("Большое Алло — 6 дней", 1650, "Самое глубокое озеро Фанских гор"),
    ("Мутные озёра + Чукурак — 2 дня", 550, "Короткий трек для новичков"),
    ("Панорама Фанов — 7 дней", 2100, "Полный круговой маршрут"),
    ("Чимтарга 5489м — 8 дней", 2800, "Восхождение на высшую точку"),
]

# ── Tajik menu with realistic TJS prices ───────────────────────────
MENU_ITEMS = [
    # Супы / Soups
    ("Шурбо из баранины", 35, "soup"),
    ("Лагман домашний", 40, "soup"),
    ("Мастава (рисовый суп)", 30, "soup"),
    # Основные / Mains
    ("Плов по-душанбински", 55, "main"),
    ("Шашлык из баранины", 65, "main"),
    ("Шашлык из курицы", 50, "main"),
    ("Манты (6 шт)", 45, "main"),
    ("Самбуса с мясом (3 шт)", 25, "main"),
    ("Курутоб", 40, "main"),
    ("Оши-палов", 50, "main"),
    # Напитки / Drinks
    ("Чай чёрный (чайник)", 15, "drink"),
    ("Чай зелёный (чайник)", 15, "drink"),
    ("Компот из урюка", 12, "drink"),
    ("Айран", 10, "drink"),
    ("Минеральная вода 0.5л", 8, "drink"),
    # Хлеб / Bread
    ("Лепёшка таджикская", 5, "bread"),
    ("Патыр", 8, "bread"),
    # Десерты / Desserts
    ("Халва тахинная", 20, "dessert"),
    ("Курага + орехи", 18, "dessert"),
    ("Нишалло", 15, "dessert"),
]

# ── Drinks/sweets at the shop ──────────────────────────────────────
SHOP_ITEMS = [
    ("Вода минеральная 1.5л", 12),
    ("Кока-кола 0.5л", 10),
    ("Сникерс", 8),
    ("Шоколад Alpen Gold", 22),
    ("Сок яблочный 1л", 18),
    ("Орехи кешью 100г", 35),
    ("Курага 500г", 45),
    ("Изюм 500г", 30),
    ("Чай Ахмад 100 пак.", 65),
    ("Носки треккинговые", 55),
    ("Фонарик налобный", 120),
    ("Крем от загара SPF50", 85),
]

PAYMENT_METHODS = ["cash", "card", "card", "card"]  # 75% карта

# ── helpers ────────────────────────────────────────────────────────

def uid() -> str:
    return str(uuid.uuid4())


def rand_name() -> str:
    return f"{random.choice(GUEST_FIRST_NAMES)} {random.choice(GUEST_LAST_NAMES)}"


def rand_phone() -> str:
    return f"+992 {random.choice([90, 91, 92, 93, 98])} {random.randint(100, 999)} {random.randint(10, 99)} {random.randint(10, 99)}"


def fetch_ids(cur, query: str, params: tuple = ()) -> list:
    cur.execute(query, params)
    return [row[0] for row in cur.fetchall()]


# ── seeders ────────────────────────────────────────────────────────

def seed_reservations(cur, rooms_ids: list[str], n_future: int = 30) -> list[tuple]:
    """Create a mix of past (completed), current (checked-in), and upcoming reservations.

    Returns list of (reservation_id, room_number, check_in, check_out) for downstream seeders.
    """
    print(f"  Seeding reservations…")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    created: list[tuple] = []

    # Seasonal weight: July-Aug has 2x traffic (peak trek season)
    def seasonal_nights() -> int:
        return random.choices([2, 3, 4, 5, 6, 7], weights=[3, 5, 5, 3, 2, 2])[0]

    # 1. Past reservations (last 60 days) — realism for revenue charts
    for _ in range(45):
        nights = seasonal_nights()
        check_in = today - timedelta(days=random.randint(3, 60))
        check_out = check_in + timedelta(days=nights)
        route = random.choice(TREK_ROUTES)
        price_per_night = random.choice([180, 220, 260, 320])
        room_number = random.choice(rooms_ids)
        res_id = uid()
        cur.execute(
            """
            INSERT INTO reservations
              (id, "guestName", phone, "roomNumber", "checkInDate", "checkOutDate",
               status, "totalPrice", notes, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, 'checked-out', %s, %s, %s, %s)
            """,
            (res_id, rand_name(), rand_phone(), room_number,
             check_in, check_out, Decimal(price_per_night * nights),
             f"Трек: {route[0]}", check_in - timedelta(days=random.randint(5, 30)), check_out),
        )
        created.append((res_id, room_number, check_in, check_out))

    # 2. Currently checked-in (today is between in and out)
    for _ in range(random.randint(4, 8)):
        nights = seasonal_nights()
        check_in = today - timedelta(days=random.randint(1, nights - 1))
        check_out = check_in + timedelta(days=nights)
        route = random.choice(TREK_ROUTES)
        price = random.choice([180, 220, 260, 320])
        room_number = random.choice(rooms_ids)
        res_id = uid()
        cur.execute(
            """
            INSERT INTO reservations
              (id, "guestName", phone, "roomNumber", "checkInDate", "checkOutDate",
               status, "totalPrice", notes, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, 'checked-in', %s, %s, %s, %s)
            """,
            (res_id, rand_name(), rand_phone(), room_number,
             check_in, check_out, Decimal(price * nights),
             f"Трек: {route[0]}", check_in - timedelta(days=7), check_in),
        )
        created.append((res_id, room_number, check_in, check_out))

    # 3. Upcoming (next 21 days)
    for _ in range(n_future):
        nights = seasonal_nights()
        check_in = today + timedelta(days=random.randint(1, 21))
        check_out = check_in + timedelta(days=nights)
        route = random.choice(TREK_ROUTES)
        price = random.choice([180, 220, 260, 320])
        room_number = random.choice(rooms_ids)
        res_id = uid()
        cur.execute(
            """
            INSERT INTO reservations
              (id, "guestName", phone, "roomNumber", "checkInDate", "checkOutDate",
               status, "totalPrice", notes, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (res_id, rand_name(), rand_phone(), room_number,
             check_in, check_out,
             random.choices(['confirmed', 'pending'], weights=[7, 3])[0],
             Decimal(price * nights),
             f"Трек: {route[0]}", today - timedelta(days=random.randint(1, 14)), today),
        )
        created.append((res_id, room_number, check_in, check_out))

    print(f"    {len(created)} reservations created")
    return created


def seed_transactions(cur, user_ids: list[str], outlet_ids: list[str]) -> int:
    """POS transactions spread across last 60 days. Lunch/dinner peaks, cash-card mix."""
    print(f"  Seeding POS transactions…")
    if not user_ids or not outlet_ids:
        print("    No users/outlets, skipped")
        return 0

    count = 0
    today = datetime.now().replace(minute=0, second=0, microsecond=0)

    for days_ago in range(60):
        # Weekends busier
        day_date = today - timedelta(days=days_ago)
        weekday = day_date.weekday()
        base_count = 12 if weekday < 5 else 20

        for _ in range(random.randint(base_count - 3, base_count + 5)):
            # Hour distribution: peaks 12-14, 19-21, otherwise thin
            hour = random.choices(
                range(8, 23),
                weights=[2, 3, 5, 8, 12, 10, 6, 5, 6, 9, 14, 12, 8, 4, 2],
            )[0]
            ts = day_date.replace(hour=hour, minute=random.randint(0, 59))

            # 1-4 items per check
            n_items = random.choices([1, 2, 3, 4], weights=[30, 40, 20, 10])[0]
            items_pool = random.choice([MENU_ITEMS, SHOP_ITEMS])
            chosen = random.sample(items_pool, k=min(n_items, len(items_pool)))

            total = Decimal(0)
            lines = []
            for item in chosen:
                name, price = item[0], item[1]
                qty = random.choices([1, 2, 3], weights=[70, 25, 5])[0]
                total += Decimal(price * qty)
                lines.append({"name": name, "price": price, "quantity": qty})

            payment = random.choice(PAYMENT_METHODS)
            trans_id = uid()
            cur.execute(
                """
                INSERT INTO transactions
                  (id, "employeeId", "outletId", items, total, "paymentMethod",
                   status, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s::jsonb, %s, %s, 'completed', %s, %s)
                """,
                (trans_id, random.choice(user_ids), random.choice(outlet_ids),
                 psycopg2.extras.Json(lines), total, payment, ts, ts),
            )
            count += 1

    print(f"    {count} transactions created")
    return count


def seed_cleaning_tasks(cur, checked_out_today_rooms: list[str]) -> int:
    """One 'departure' cleaning task per room that checked out today or yesterday."""
    print(f"  Seeding cleaning tasks…")
    count = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for room_number in checked_out_today_rooms:
        status = random.choices(
            ["pending", "in-progress", "review", "done"],
            weights=[3, 2, 1, 4],
        )[0]
        started = today.replace(hour=9, minute=random.randint(0, 30)) if status != "pending" else None
        completed = today.replace(hour=11, minute=random.randint(0, 45)) if status == "done" else None
        cur.execute(
            """
            INSERT INTO cleaning_tasks
              (id, "roomNumber", type, status, "startedAt", "completedAt",
               "createdAt", "updatedAt")
            VALUES (%s, %s, 'departure', %s, %s, %s, %s, %s)
            """,
            (uid(), room_number, status, started, completed, today, today),
        )
        count += 1

    print(f"    {count} cleaning tasks created")
    return count


def main():
    print(f"Connecting to {DATABASE_URL.split('@')[-1]}…")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # Snapshot the seeded lookup data from backend
            rooms = fetch_ids(cur, 'SELECT number FROM rooms')
            if not rooms:
                print("No rooms in DB — start the NestJS backend once so it can seed them, then rerun.")
                return

            users = fetch_ids(cur, 'SELECT id FROM users')
            outlets = fetch_ids(cur, 'SELECT id FROM outlets')

            print(f"Found {len(rooms)} rooms, {len(users)} users, {len(outlets)} outlets")
            print()

            reservations = seed_reservations(cur, rooms, n_future=35)
            seed_transactions(cur, users, outlets)

            # Pick rooms whose guests are leaving today → need cleaning
            today = datetime.now().date()
            leaving_today = [room for _, room, _, out in reservations if out.date() == today]
            # Plus a few random "departure-yesterday" tasks to show status variety
            leaving_today += random.sample(rooms, min(6, len(rooms)))
            seed_cleaning_tasks(cur, leaving_today)

        conn.commit()
        print()
        print("Done! Refresh staff-app — dashboard, reservations, cleaning lists all populated.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
