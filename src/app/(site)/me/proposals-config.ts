/**
 * Подборка в кабинете клиента («Мы подобрали для вас…») — пять вариантов на
 * выбор. Переключатель видят админы и локальная разработка; клиенты — вариант
 * по умолчанию. После выбора лишние варианты удалить.
 */
export const PROPOSAL_VARIANTS = [
  { n: 1, label: "Список" },
  { n: 2, label: "Карточки" },
  { n: 3, label: "Сравнение" },
  { n: 4, label: "Вкладки" },
  { n: 5, label: "Крупные фото" },
] as const;

export const DEFAULT_PROPOSAL_VARIANT = 1;

export type Proposal = {
  matchId: number;
  chosen: boolean;
  note: string | null;
  psy: {
    id: number;
    slug: string | null;
    name: string;
    photoUrl: string | null;
    approach: string | null;
    experienceYears: number | null;
    about: string | null;
    gradeTitle: string | null;
    price: string | null;
    nearestSlot: string | null;
    topics: string[];
  };
};
