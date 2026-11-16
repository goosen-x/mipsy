import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Faq } from "@/content/faq";

export function FaqList({ items, className }: { items: Faq[]; className?: string }) {
  return (
    <Accordion type="single" collapsible className={className}>
      {items.map((f) => (
        <AccordionItem key={f.q} value={f.q}>
          <AccordionTrigger className="cursor-pointer text-left text-lg font-semibold">
            {f.q}
          </AccordionTrigger>
          <AccordionContent className="text-base text-neutral-600">
            {f.a}
            {f.crisisLink && (
              <>
                {" "}
                <Link href="/crisis" className="text-brand-700 underline">
                  Телефоны горячих линий
                </Link>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
