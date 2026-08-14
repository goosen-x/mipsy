import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata = { title: "Срочная помощь — mipsy" };

// Экран экстренных контактов. Используется и как отдельная страница,
// и как цель кризисной ветки анкеты.
export default function CrisisPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Если помощь нужна прямо сейчас</h1>
        <p className="mt-4 text-lg text-neutral-700">
          Подбор психолога занимает время, а иногда поддержка нужна немедленно. Это нормально —
          позвонить. Там отвечают живые люди, бесплатно и анонимно, круглосуточно.
        </p>
        <ul className="mt-8 space-y-4">
          <li className="rounded-2xl border border-neutral-200 p-5">
            <div className="text-xl font-semibold">8 (800) 2000-122</div>
            <div className="text-neutral-600">
              Телефон доверия для детей, подростков и родителей — бесплатно по России
            </div>
          </li>
          <li className="rounded-2xl border border-neutral-200 p-5">
            <div className="text-xl font-semibold">+7 (495) 989-50-50</div>
            <div className="text-neutral-600">Горячая линия психологической помощи МЧС России</div>
          </li>
          <li className="rounded-2xl border border-neutral-200 p-5">
            <div className="text-xl font-semibold">051 (с мобильного — 8 (495) 051)</div>
            <div className="text-neutral-600">
              Московская служба психологической помощи, круглосуточно
            </div>
          </li>
          <li className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="text-xl font-semibold">112</div>
            <div className="text-neutral-600">
              Единый номер экстренных служб — если есть угроза жизни
            </div>
          </li>
        </ul>
        <p className="mt-8 text-neutral-600">
          Когда острый момент пройдёт, мы будем рады помочь подобрать психолога для регулярной
          работы —{" "}
          <Link href="/login" className="font-medium text-brand-700 underline">
            подбор начинается в личном кабинете
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
