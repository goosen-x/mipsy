import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Справочник тем — общий для анкеты, профилей психологов и лендинга.
export const topics = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  sort: integer("sort").notNull().default(0),
});

// Заявка клиента = результат прохождения анкеты-визарда.
export const clientRequests = sqliteTable("client_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),

  forWhom: text("for_whom").notNull(), // self | pair | child (pair/child — «скоро»)
  gender: text("gender"), // female | male | skip
  age: integer("age"),
  therapyExperience: text("therapy_experience"), // none | short | long
  mainProblem: text("main_problem"),
  topicSlugs: text("topic_slugs", { mode: "json" }).$type<string[]>(),
  topicOther: text("topic_other"),

  // Сокращённый скрининг: never | seldom | monthly | weekly | daily
  freqDown: text("freq_down"),
  freqSleep: text("freq_sleep"),
  freqSelfHarm: text("freq_self_harm"),
  lifeImpact: text("life_impact"), // none | some | strong | unbearable

  prefGender: text("pref_gender"), // man | woman | any
  prefAge: text("pref_age"), // under40 | over40 | any
  preferredTime: text("preferred_time", { mode: "json" }).$type<string[]>(), // morning | day | evening | weekend

  story: text("story"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  pdConsent: integer("pd_consent", { mode: "boolean" }).notNull().default(false),

  crisisFlag: integer("crisis_flag", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("new"), // new | called | matched | rematch | rejected
  operatorNotes: text("operator_notes"),

  // Личный кабинет клиента открывается по секретной ссылке (SMS от оператора).
  clientToken: text("client_token").unique(),
  rematchReason: text("rematch_reason"), // почему предыдущий специалист не подошёл
});

// Психолог: заявка на модерацию и, после одобрения, публичный профиль.
// Контакты (phone/email) видит только оператор — на публичную страницу не выводить.
export const psychologists = sqliteTable("psychologists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  cabinetToken: text("cabinet_token").notNull().unique(), // доступ в кабинет по секретной ссылке
  slug: text("slug").unique(), // адрес публичной страницы, назначается при одобрении

  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),

  // Поля модерации — широкая заявка, пороги оператор решает вручную
  education: text("education"), // вузы, программы, годы
  educationDocs: text("education_docs"), // ссылки/описание документов
  experienceYears: integer("experience_years"),
  supervision: text("supervision"),
  personalTherapy: text("personal_therapy"),
  moderationStatus: text("moderation_status").notNull().default("new"), // new | approved | rejected
  moderationNotes: text("moderation_notes"),

  // Профиль: 7 фиксированных секций
  photoUrl: text("photo_url"),
  approach: text("approach"),
  format: text("format"), // online | offline | both
  price: text("price"), // заглушка до решения по ценам
  about: text("about"), // максимум 2–3 абзаца
  topicSlugs: text("topic_slugs", { mode: "json" }).$type<string[]>(),
  howSessions: text("how_sessions"),
  faq: text("faq", { mode: "json" }).$type<{ q: string; a: string }[]>(),
  introCallEnabled: integer("intro_call_enabled", { mode: "boolean" })
    .notNull()
    .default(false), // бесплатная встреча-знакомство 20 минут
});

// Привязка клиент↔психолог; переподбор = деактивация старой и новая запись.
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  clientRequestId: integer("client_request_id")
    .notNull()
    .references(() => clientRequests.id),
  psychologistId: integer("psychologist_id")
    .notNull()
    .references(() => psychologists.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  note: text("note"),
});

// Календарь по образцу Zigmund: психолог отмечает свободные интервалы,
// клиент записывается только в свободные. Слот — единственный источник правды
// о встречах. meetingLink — задел под встроенные звонки.
export const slots = sqliteTable("slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  psychologistId: integer("psychologist_id")
    .notNull()
    .references(() => psychologists.id),
  startsAt: text("starts_at").notNull(), // локальное время психолога, "YYYY-MM-DDTHH:mm"
  durationMin: integer("duration_min").notNull().default(50),
  status: text("status").notNull().default("free"), // free | booked | done | cancelled
  clientRequestId: integer("client_request_id").references(() => clientRequests.id),
  isIntroCall: integer("is_intro_call", { mode: "boolean" }).notNull().default(false),
  meetingLink: text("meeting_link"),
});
