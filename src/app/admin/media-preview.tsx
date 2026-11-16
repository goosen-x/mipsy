"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

/** Превью загруженных файлов: картинки открываются крупно в диалоге, PDF —
 * в новой вкладке (у браузера уже есть свой вьюер, дублировать смысла нет). */
export function DocThumbnails({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (urls.length === 0) return <span>—</span>;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => {
          const ext = url.split(".").pop()?.toLowerCase();
          const isImage = ext ? IMAGE_EXT.has(ext) : false;
          return isImage ? (
            <button
              key={url}
              type="button"
              onClick={() => setOpen(url)}
              className="h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-200 hover:border-brand-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Документ ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:border-brand-400"
            >
              <span>{ext?.toUpperCase()}</span>
              <span>Документ {i + 1}</span>
            </a>
          );
        })}
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl bg-transparent p-0 ring-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">Документ крупно</DialogTitle>
          {open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={open}
              alt="Документ крупно"
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Фото профиля: миниатюра с кликом на увеличение — так же, как документы. */
export function PhotoPreview({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-brand-100 text-xs text-brand-700">
        нет фото
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-24 w-24 cursor-pointer overflow-hidden rounded-xl border border-neutral-200 hover:border-brand-400"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Фото психолога" className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-transparent p-0 ring-0">
          <DialogTitle className="sr-only">Фото психолога крупно</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Фото психолога крупно"
            className="max-h-[85vh] w-full rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
