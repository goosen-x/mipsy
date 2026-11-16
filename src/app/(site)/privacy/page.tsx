import { DocBlocks, LegalPage, type DocBlock } from "@/components/legal";
import blocks from "@/content/legal/privacy.json";

export const metadata = { title: "Политика обработки персональных данных — mipsy" };

// Текст — документ МИП без правок (src/content/legal/privacy.json).
export default function PrivacyPage() {
  return (
    <LegalPage title="Политика в отношении обработки персональных данных">
      <DocBlocks blocks={blocks as DocBlock[]} />
    </LegalPage>
  );
}
