import { DocBlocks, LegalPage, type DocBlock } from "@/components/legal";
import blocks from "@/content/legal/rassylka.json";

export const metadata = { title: "Согласие на рекламную рассылку — mipsy" };

// Текст — документ МИП без правок (src/content/legal/rassylka.json).
export default function RassylkaPage() {
  return (
    <LegalPage title="Согласие на рекламу и обработку персональных данных в целях рекламной рассылки">
      <DocBlocks blocks={blocks as DocBlock[]} />
    </LegalPage>
  );
}
