import { DocBlocks, LegalPage, type DocBlock } from "@/components/legal";
import blocks from "@/content/legal/ethics.json";

export const metadata = { title: "Соглашение о профессиональных стандартах и этике — mipsy" };

// Текст — документ МИП без правок (src/content/legal/ethics.json).
export default function EthicsPage() {
  return (
    <LegalPage title="Соглашение о профессиональных стандартах, этике и безопасности психологического консультирования">
      <DocBlocks blocks={blocks as DocBlock[]} />
    </LegalPage>
  );
}
