import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Аккаунт — сам человек, отдельно от его обращений. Вход на сайте по email:
 * запрашиваем код, отправляем письмом, дальше живёт сессия. Пароля нет намеренно —
 * хранить нечего, а человеку в тяжёлом состоянии не нужно ничего придумывать.
 */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  email: text("email").notNull().unique(), // всегда в нижнем регистре
  name: text("name").notNull(),
  phone: text("phone"),

  loginCode: text("login_code"), // шесть цифр, живут 15 минут
  loginCodeSentAt: text("login_code_sent_at"),
  loginAttempts: integer("login_attempts").notNull().default(0),
  lastLoginAt: text("last_login_at"),
});

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
  // Чей это запрос. У старых заявок, заведённых до личных кабинетов, аккаунта нет.
  accountId: integer("account_id").references(() => accounts.id),

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
  // Телефон больше не спрашиваем: связь с клиентом идёт почтой. У прежних
  // заявок номер сохранён, у новых его нет.
  phone: text("phone"),
  email: text("email"),
  pdConsent: integer("pd_consent", { mode: "boolean" }).notNull().default(false),

  crisisFlag: integer("crisis_flag", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("new"), // new | called | matched | rematch | rejected
  operatorNotes: text("operator_notes"),

  // Старые письма ведут на /me/<token>; ссылка сама доступа не даёт, только редирект на вход.
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
  cabinetToken: text("cabinet_token").notNull().unique(), // старые ссылки /cab/<token>: редирект на вход
  slug: text("slug").unique(), // адрес публичной страницы, назначается при одобрении
  accountId: integer("account_id").references(() => accounts.id),

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
    .default(false), // историческое поле: первая встреча теперь бесплатна у всех

  // Профиль изменён после одобрения — оператор должен перечитать тексты.
  needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),

  // Постоянная ссылка на видеовстречу (Телемост, Zoom и т.п.) — своего видеомодуля не делаем.
  meetingUrl: text("meeting_url"),
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
  // Оператор предлагает 2–3 специалистов, клиент выбирает одного из них.
  chosen: integer("chosen", { mode: "boolean" }).notNull().default(false),
  note: text("note"),
});

/** Отзыв клиента о состоявшейся встрече. Публикуется после модерации. */
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  psychologistId: integer("psychologist_id")
    .notNull()
    .references(() => psychologists.id),
  clientRequestId: integer("client_request_id")
    .notNull()
    .references(() => clientRequests.id),
  slotId: integer("slot_id").references(() => slots.id),
  rating: integer("rating").notNull(), // 1–5
  body: text("body"),
  authorName: text("author_name").notNull(), // имя клиента, показываем как «Ольга»
  status: text("status").notNull().default("pending"), // pending | published | rejected
  moderationNotes: text("moderation_notes"),
});

/** Обращения в поддержку и жалобы — от клиентов и от психологов. */
export const supportTickets = sqliteTable("support_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  fromRole: text("from_role").notNull(), // client | psychologist
  kind: text("kind").notNull(), // question | complaint
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  body: text("body").notNull(),
  clientRequestId: integer("client_request_id").references(() => clientRequests.id),
  psychologistId: integer("psychologist_id").references(() => psychologists.id),
  status: text("status").notNull().default("new"), // new | in_progress | closed
  operatorNotes: text("operator_notes"),
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

/**
 * Исходящие уведомления. Если задан ключ SMS-провайдера — отправляются автоматически,
 * иначе копятся здесь и оператор отправляет их вручную из админки.
 */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  kind: text("kind").notNull(), // booked | rescheduled | cancelled | reminder | matched | moderation | review | login
  channel: text("channel").notNull().default("sms"), // sms | email
  recipientRole: text("recipient_role").notNull(), // client | psychologist
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientEmail: text("recipient_email"),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | failed
  sentAt: text("sent_at"),
  error: text("error"),
  clientRequestId: integer("client_request_id").references(() => clientRequests.id),
  psychologistId: integer("psychologist_id").references(() => psychologists.id),
  slotId: integer("slot_id").references(() => slots.id),
});

/**
 * Коды подтверждения для адресов, у которых аккаунта ещё нет. Аккаунт заводим
 * только после того, как человек докажет, что почта его: до этого момента вход
 * и регистрация выглядят одинаково, и перебором адресов ничего не узнать.
 * Строки живут сутки.
 */
export const emailCodes = sqliteTable("email_codes", {
  email: text("email").primaryKey(),
  code: text("code").notNull(),
  sentAt: text("sent_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
});

/**
 * Журнал попыток входа. Нужен ровно для одного разговора: «мне не пришёл код».
 * Без него случай «такой почты у нас нет» не оставляет следа вообще — письмо
 * не отправляется, в очереди уведомлений пусто, и оператору нечего сказать.
 * Не в error_log: это не ошибка приложения, а по нему считаются алерты.
 */
export const loginLog = sqliteTable("login_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  email: text("email").notNull(), // ровно то, что человек ввёл, в нижнем регистре
  outcome: text("outcome").notNull(),
  // bad_email | no_account | sent | delivery_failed | wrong_code | expired | blocked | signed_in
  detail: text("detail"),
});

/** Журнал ошибок приложения: видно в админке, не нужно лезть в docker logs. */
export const errorLog = sqliteTable("error_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  source: text("source").notNull(), // request | action | notify | job
  message: text("message").notNull(),
  detail: text("detail"),
  path: text("path"),
  seen: integer("seen", { mode: "boolean" }).notNull().default(false),
});

/** Журнал действий администратора — требование по работе с данными о здоровье. */
export const adminLog = sqliteTable("admin_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  action: text("action").notNull(),
  targetType: text("target_type"), // request | psychologist | review | ticket | notification
  targetId: integer("target_id"),
  detail: text("detail"),
});
