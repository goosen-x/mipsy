import { asc } from "drizzle-orm";
import { db, topics } from "@/db";
import { currentAccount } from "@/lib/auth";
import { AnketaWizard } from "./wizard";

export const metadata = { title: "Анкета — mipsy" };
export const dynamic = "force-dynamic";

export default async function AnketaPage() {
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  // Если человек уже подтвердил почту на входе, второй раз её не спрашиваем.
  const account = await currentAccount();
  return (
    <AnketaWizard
      topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))}
      knownEmail={account?.email ?? ""}
    />
  );
}
