import { DocBlocks, LegalPage, type DocBlock } from "@/components/legal";
import blocks from "@/content/legal/rules.json";

export const metadata = { title: "Правила безопасной психологической консультации — mipsy" };

// Текст — документ МИП без правок (src/content/legal/rules.json).
export default function RulesPage() {
  return (
    <LegalPage title="Правила безопасной психологической консультации">
      <DocBlocks blocks={blocks as DocBlock[]} />
    </LegalPage>
  );
}
