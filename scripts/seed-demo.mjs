// Демо-данные: три одобренных психолога с профилями и расписанием.
// Запуск на сервере: docker exec mipsy node /app/data/seed-demo.mjs
// Удалить: docker exec mipsy node -e "...DELETE FROM psychologists WHERE cabinet_token LIKE 'demo-%'"
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
const db = new Database(dbPath);

const PSYCHOLOGISTS = [
  {
    token: "demo-kovaleva",
    slug: "mariya-kovaleva",
    photoUrl: "/demo/kovaleva.jpg",
    name: "Мария Ковалёва",
    phone: "+79001110011",
    email: "demo1@mipsy.test",
    approach: "Когнитивно-поведенческая терапия",
    experienceYears: 9,
    format: "online",
    price: "3 500 ₽ / 50 минут",
    education:
      "МГУ им. Ломоносова, факультет психологии, специалитет, 2014\nАссоциация когнитивно-поведенческой терапии, программа по КПТ, 560 часов, 2017",
    supervision: "Индивидуальная супервизия раз в две недели",
    personalTherapy: "Личная терапия с 2015 года, продолжается",
    about:
      "Работаю с тревогой, паническими состояниями и бессонницей — тем, что мешает жить обычной жизнью прямо сейчас.\n\nВ КПТ мы разбираем, как мысли, чувства и действия связаны между собой, и находим, где в этой цепочке можно что-то поменять. Даю домашние задания — небольшие, но именно они дают результат между встречами.\n\nМне важно, чтобы через несколько сессий вы почувствовали не «стало легче поговорить», а «я стал(а) иначе справляться».",
    topicSlugs: ["anxiety", "sleep", "burnout", "work-study"],
    howSessions:
      "Онлайн, 50 минут, обычно раз в неделю. Первые две-три встречи разбираемся в запросе и формулируем цель, дальше работаем по плану и сверяемся с ним примерно раз в месяц.",
    faq: [
      {
        q: "Сколько встреч обычно нужно?",
        a: "При тревожных состояниях заметные изменения чаще всего появляются к 8–10 сессии. Но решение продолжать всегда за вами.",
      },
      {
        q: "Что если я не смогу выполнять домашние задания?",
        a: "Это нормально и само по себе материал для работы: обычно за «не смог» стоит что-то важное, и мы это обсуждаем без осуждения.",
      },
    ],
    days: [1, 3, 5], // пн, ср, пт
    times: ["11:00", "15:00", "19:00"],
  },
  {
    token: "demo-demyanov",
    slug: "igor-demyanov",
    photoUrl: "/demo/demyanov.jpg",
    name: "Игорь Демьянов",
    phone: "+79001110022",
    email: "demo2@mipsy.test",
    approach: "Гештальт-терапия",
    experienceYears: 12,
    format: "both",
    price: "4 200 ₽ / 60 минут",
    education:
      "СПбГУ, факультет психологии, магистратура, 2011\nМосковский гештальт-институт, полная программа, 720 часов, 2015",
    supervision: "Групповая и индивидуальная супервизия ежемесячно",
    personalTherapy: "Личная терапия 6 лет",
    about:
      "Работаю с отношениями: конфликты в паре, отдаление от близких, одиночество внутри семьи, трудности с тем, чтобы злиться и говорить «нет».\n\nВ гештальт-подходе многое происходит в самом контакте между нами: то, как вы строите отношения в жизни, проявляется и на сессии — и это можно рассмотреть в безопасной обстановке.\n\nЯ не даю советов, как жить, но помогаю заметить, что вы делаете для того, чтобы получалось именно так, и что можно попробовать иначе.",
    topicSlugs: ["relationships", "family", "loneliness", "anger"],
    howSessions:
      "Онлайн или очно в Москве, 60 минут, раз в неделю. Работаю и с парами — тогда встречи длятся 90 минут и обсуждаются отдельно.",
    faq: [
      {
        q: "Можно прийти вдвоём с партнёром?",
        a: "Да, я работаю с парами. Формат обсудим на первой встрече — иногда полезно начать с индивидуальных сессий.",
      },
      {
        q: "Мне сложно говорить о чувствах. Это помешает?",
        a: "Нет. Умение называть чувства — не условие входа, а один из результатов работы.",
      },
    ],
    days: [2, 4, 6], // вт, чт, сб
    times: ["10:00", "13:00", "18:00"],
  },
  {
    token: "demo-severtseva",
    slug: "alina-severtseva",
    photoUrl: "/demo/severtseva.jpg",
    name: "Алина Северцева",
    phone: "+79001110033",
    email: "demo3@mipsy.test",
    approach: "Схема-терапия",
    experienceYears: 6,
    format: "online",
    price: "3 000 ₽ / 50 минут",
    education:
      "РГГУ, психология, бакалавриат и магистратура, 2018\nИнститут схема-терапии, сертификационная программа, 220 часов, 2021",
    supervision: "Супервизия дважды в месяц",
    personalTherapy: "Личная терапия 4 года",
    about:
      "Помогаю разобраться с тем, что тянется с детства и продолжает влиять на взрослую жизнь: жёсткая самокритика, ощущение «со мной что-то не так», страх быть отвергнутым.\n\nСхема-терапия соединяет разговор о прошлом с конкретными техниками для настоящего — мы не просто вспоминаем, а меняем то, как вы обращаетесь с собой сегодня.\n\nЧасто ко мне приходят после того, как поддерживающая беседа перестала помогать и хочется двинуться глубже.",
    topicSlugs: ["self-esteem", "childhood-trauma", "depression", "life-changes"],
    howSessions:
      "Онлайн, 50 минут, раз в неделю. Первые встречи посвящаем истории и составляем карту повторяющихся сценариев, дальше работаем с ними по шагам.",
    faq: [
      {
        q: "Придётся подробно вспоминать детство?",
        a: "Только в том темпе, который вам подходит. Мы никогда не идём в тяжёлые воспоминания без вашей готовности и опоры.",
      },
      {
        q: "Чем это отличается от обычной беседы с психологом?",
        a: "Есть структура: мы вместе видим повторяющийся сценарий и целенаправленно его меняем, а не только обсуждаем текущие события.",
      },
    ],
    days: [1, 2, 4], // пн, вт, чт
    times: ["12:00", "16:00", "20:00"],
  },
];

const insertPsy = db.prepare(`
  INSERT INTO psychologists
    (cabinet_token, slug, name, phone, email, education, education_docs, experience_years,
     supervision, personal_therapy, moderation_status, approach, format, price, about,
     topic_slugs, how_sessions, faq, photo_url, intro_call_enabled)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, 0)
`);
const insertSlot = db.prepare(
  "INSERT INTO slots (psychologist_id, starts_at, duration_min, status, is_intro_call) VALUES (?, ?, ?, 'free', 0)",
);
const findPsy = db.prepare("SELECT id FROM psychologists WHERE cabinet_token = ?");
const pad = (n) => String(n).padStart(2, "0");

let created = 0;
let slotsCreated = 0;

for (const p of PSYCHOLOGISTS) {
  if (findPsy.get(p.token)) {
    console.log(`пропуск: ${p.name} уже есть`);
    continue;
  }
  insertPsy.run(
    p.token, p.slug, p.name, p.phone, p.email, p.education,
    "демо-данные, документы не прикладывались", p.experienceYears,
    p.supervision, p.personalTherapy, p.approach, p.format, p.price, p.about,
    JSON.stringify(p.topicSlugs), p.howSessions, JSON.stringify(p.faq), p.photoUrl,
  );
  const { id } = findPsy.get(p.token);
  created++;

  // Расписание на три недели вперёд, только в «рабочие» дни специалиста.
  const now = new Date();
  for (let offset = 1; offset <= 21; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!p.days.includes(d.getDay())) continue;
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const time of p.times) {
      insertSlot.run(id, `${day}T${time}`, p.format === "both" ? 60 : 50);
      slotsCreated++;
    }
  }
  console.log(`создан: ${p.name} → /p/${p.slug}, кабинет /cab/${p.token}`);
}

console.log(`Готово: психологов ${created}, окон в расписании ${slotsCreated}`);
