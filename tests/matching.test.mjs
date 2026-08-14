// Автоподбор по анкете: скоринг, жёсткое правило пола и запись предложений —
// через src/lib/matching.ts, тот же код, что зовёт submitAnketa.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { autoMatch, catalogUrlFor, scoreCandidate, wantedGender } from "../src/lib/matching.ts";

const NOW = new Date("2026-08-14T12:00:00Z");

test("пол специалиста — жёсткое условие, а не очки", () => {
  const prefs = { topicSlugs: ["anxiety"], prefGender: "woman", prefAge: "any" };
  const woman = { id: 1, gender: "female", birthYear: 1990, topicSlugs: [] };
  const man = { id: 2, gender: "male", birthYear: 1990, topicSlugs: ["anxiety"] };
  const unknown = { id: 3, gender: null, birthYear: null, topicSlugs: [] };

  assert.equal(scoreCandidate(man, prefs, NOW), null, "мужчина отсеян, даже с совпавшей темой");
  assert.equal(scoreCandidate(woman, prefs, NOW), 0, "женщина проходит и без общих тем");
  assert.equal(scoreCandidate(unknown, prefs, NOW), 0, "старый профиль без пола не отсеивается");
});

test("темы весят больше возраста", () => {
  const prefs = { topicSlugs: ["anxiety", "sleep"], prefGender: "any", prefAge: "under40" };
  const byTopics = { id: 1, gender: null, birthYear: 1970, topicSlugs: ["anxiety", "sleep"] };
  const byAge = { id: 2, gender: null, birthYear: 1995, topicSlugs: [] };

  assert.equal(scoreCandidate(byTopics, prefs, NOW), 4, "две темы = 4 очка");
  assert.equal(scoreCandidate(byAge, prefs, NOW), 1, "возраст = 1 очко");
});

test("ссылка «выбрать самому» несёт фильтры анкеты", () => {
  assert.equal(
    catalogUrlFor({ topicSlugs: ["anxiety", "sleep"], prefGender: "man", prefAge: "over40" }),
    "/catalog?topic=anxiety&gender=male&age=over40",
  );
  assert.equal(catalogUrlFor({ topicSlugs: [], prefGender: "any", prefAge: null }), "/catalog");
  assert.equal(wantedGender("woman"), "female");
  assert.equal(wantedGender("any"), null);
});

// --- против настоящей базы ---

let dir;
let sqlite;
let db;

function addPsy(name, { status = "approved", gender = null, birthYear = null, topics = [] } = {}) {
  return Number(
    sqlite
      .prepare(
        "INSERT INTO psychologists (cabinet_token, name, phone, moderation_status, gender, birth_year, topic_slugs) VALUES (?,?,'+70000000000',?,?,?,?)",
      )
      .run(`t-${name}`, name, status, gender, birthYear, JSON.stringify(topics)).lastInsertRowid,
  );
}

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-matching-"));
  const dbPath = path.join(dir, "test.db");
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "pipe",
  });
  sqlite = new Database(dbPath);
  db = drizzle(sqlite);
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

test("автоподбор пишет до трёх предложений и переводит заявку в matched", async () => {
  const reqId = Number(
    sqlite
      .prepare("INSERT INTO client_requests (for_whom, name, pd_consent, client_token) VALUES ('self','Клиент',1,'m1')")
      .run().lastInsertRowid,
  );
  addPsy("Слабое совпадение", { topics: ["sleep"] });
  const strong1 = addPsy("Сильное-1", { topics: ["anxiety", "sleep"] });
  const strong2 = addPsy("Сильное-2", { topics: ["anxiety", "sleep"] });
  const strong3 = addPsy("Сильное-3", { topics: ["anxiety", "sleep"] });
  addPsy("Не одобрен", { status: "new", topics: ["anxiety", "sleep"] });
  addPsy("Мужчина", { gender: "male", topics: ["anxiety", "sleep"] });

  const picked = await autoMatch(db, {
    clientRequestId: reqId,
    prefs: { topicSlugs: ["anxiety", "sleep"], prefGender: "woman", prefAge: "any" },
    now: NOW,
  });

  assert.equal(picked.length, 3);
  assert.deepEqual(
    [...picked].sort((a, b) => a - b),
    [strong1, strong2, strong3],
    "в тройке сильные совпадения; мужчина и неодобренный не прошли",
  );

  const rows = sqlite
    .prepare("SELECT psychologist_id, chosen, note FROM matches WHERE client_request_id = ?")
    .all(reqId);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.chosen === 0), "клиент выбирает сам — chosen не проставлен");
  assert.ok(rows.every((r) => r.note === "автоподбор по анкете"));

  const req = sqlite.prepare("SELECT status FROM client_requests WHERE id = ?").get(reqId);
  assert.equal(req.status, "matched");
});

test("когда никто не подходит, заявка остаётся у админа", async () => {
  const reqId = Number(
    sqlite
      .prepare("INSERT INTO client_requests (for_whom, name, pd_consent, client_token) VALUES ('self','Клиентка',1,'m2')")
      .run().lastInsertRowid,
  );
  // В пуле остаётся одна женщина, а клиент просит мужчину.
  sqlite.prepare("UPDATE psychologists SET moderation_status = 'rejected'").run();
  addPsy("Женщина", { gender: "female", topics: ["anxiety"] });

  const picked = await autoMatch(db, {
    clientRequestId: reqId,
    prefs: { topicSlugs: ["anxiety"], prefGender: "man", prefAge: "any" },
    now: NOW,
  });

  assert.deepEqual(picked, []);
  assert.equal(
    sqlite.prepare("SELECT count(*) c FROM matches WHERE client_request_id = ?").get(reqId).c,
    0,
  );
  const req = sqlite.prepare("SELECT status FROM client_requests WHERE id = ?").get(reqId);
  assert.equal(req.status, "new", "оператор увидит заявку как новую");
});
