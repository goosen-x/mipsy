import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { Badge } from "@/components/ui/badge";
import { label, MODERATION_STATUS_LABELS } from "@/lib/labels";
import { ModerationControl } from "../../controls";

export default async function OpPsyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [psy] = await db.select().from(psychologists).where(eq(psychologists.id, Number(id)));
  if (!psy) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/op/psy" className="text-sm text-neutral-500 hover:text-brand-700">
          ← Все психологи
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {psy.name} <Badge className="ml-2 align-middle">{label(MODERATION_STATUS_LABELS, psy.moderationStatus)}</Badge>
          </h1>
          {psy.slug && psy.moderationStatus === "approved" && (
            <Link href={`/p/${psy.slug}`} className="text-sm text-brand-700 underline">
              Публичная страница →
            </Link>
          )}
        </div>
        <p className="mt-1 text-neutral-500">
          {psy.createdAt.slice(0, 16)} · тел. <span className="font-medium text-neutral-900">{psy.phone}</span>
          {psy.email && <> · {psy.email}</>}
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Заявка на модерацию</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Block k="Образование" v={psy.education} />
          <Block k="Документы" v={psy.educationDocs} />
          <Block k="Опыт практики" v={psy.experienceYears != null ? `${psy.experienceYears} лет` : null} />
          <Block k="Супервизия" v={psy.supervision} />
          <Block k="Личная терапия" v={psy.personalTherapy} />
        </dl>
      </section>

      {psy.needsReview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Профиль изменён после одобрения.</strong> Перечитайте тексты ниже: контакты и
          обещания клиентам не проверяются автоматически. После проверки нажмите «Одобрить» ещё раз.
        </div>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Профиль (заполняет психолог)</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Block k="Подход" v={psy.approach} />
          <Block k="Формат" v={psy.format} />
          <Block k="Цена" v={psy.price} />
          <Block k="О себе" v={psy.about} />
          <Block k="Как проходят встречи" v={psy.howSessions} />
          <Block k="Темы" v={(psy.topicSlugs ?? []).join(", ") || null} />
          <Block k="Встреча-знакомство" v={psy.introCallEnabled ? "Да, 20 минут" : "Нет"} />
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Решение</h2>
        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm">
          <div className="font-medium text-brand-800">Критерии допуска — проверьте по списку</div>
          <ul className="mt-2 space-y-1 text-neutral-700">
            <li>· высшее психологическое образование или профпереподготовка, документы приложены</li>
            <li>· обучение основному подходу: от 200 часов (КПТ-подобные) или от 500 часов (длительные)</li>
            <li>· опыт консультирования от 2 лет</li>
            <li>· личная терапия — есть</li>
            <li>· супервизия — текущая, регулярная</li>
            <li>· самозанятость или ИП (нужно для выплат)</li>
            <li>· согласие с этическим кодексом: научно обоснованные методы, запрет увода клиентов</li>
            <li>· интервью 30 минут проведено</li>
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Обоснование порогов — в docs/research/dopusk-referensy.md
          </p>
        </div>
        <div className="mt-4">
          <ModerationControl psyId={psy.id} status={psy.moderationStatus} />
        </div>
      </section>
    </div>
  );
}

function Block({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-neutral-400">{k}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-neutral-800">{v || "—"}</dd>
    </div>
  );
}
