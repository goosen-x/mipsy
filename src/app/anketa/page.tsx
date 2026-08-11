import { asc } from "drizzle-orm";
import { db, topics } from "@/db";
import { AnketaWizard } from "./wizard";

export const metadata = { title: "Анкета — mipsy" };
export const revalidate = 60;

export default async function AnketaPage() {
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  return <AnketaWizard topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))} />;
}
