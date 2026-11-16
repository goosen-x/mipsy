/**
 * Каркас юридических страниц. Тексты — черновики до вычитки юристом;
 * места, требующие реальных реквизитов, помечены [СКОБКАМИ].
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="prose-legal mt-8 space-y-4 text-base leading-relaxed text-neutral-700 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6">
          {children}
        </div>
    </main>
  );
}

export type DocBlock =
  | { t: "p" | "h2" | "h3"; x: string }
  | { t: "li"; x: string; lead?: string }
  | { t: "table"; rows: string[][] };

/** Ссылки внутри текста документов (адреса сайта и почта) делаем кликабельными. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s,;)]+|[\w.-]+@[\w.-]+\.\w+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} className="text-brand-700 underline">
            {part}
          </a>
        ) : /@/.test(part) && /^[\w.-]+@[\w.-]+\.\w+$/.test(part) ? (
          <a key={i} href={`mailto:${part}`} className="text-brand-700 underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Документ из docx МИП (конвертирован в src/content/legal/*.json): тексты
 * не правим руками, чтобы на сайте была ровно та редакция, что прислал МИП.
 */
export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "li") {
      const items: Extract<DocBlock, { t: "li" }>[] = [];
      while (i < blocks.length && blocks[i].t === "li") items.push(blocks[i++] as never);
      i--;
      out.push(
        // Пункты с номером в тексте («1. Кто ваш психолог.») — без маркеров.
        <ul key={i} className={items.some((it) => it.lead) ? "!list-none !pl-0" : undefined}>
          {items.map((it, j) => (
            <li key={j}>
              {it.lead && <strong>{it.lead} </strong>}
              <Linkify text={it.x} />
            </li>
          ))}
        </ul>,
      );
    } else if (b.t === "table") {
      const [head, ...rows] = b.rows;
      out.push(
        <div key={i} className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="border border-neutral-200 bg-neutral-50 p-2 text-left align-top">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k} className="border border-neutral-200 p-2 align-top">
                      <Linkify text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (b.t === "h2") {
      out.push(<h2 key={i}>{b.x}</h2>);
    } else if (b.t === "h3") {
      out.push(<h3 key={i}>{b.x}</h3>);
    } else {
      out.push(
        <p key={i}>
          <Linkify text={b.x} />
        </p>,
      );
    }
  }
  return <>{out}</>;
}
