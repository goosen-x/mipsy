"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Фото психолога; если файла нет или он не загрузился — буква имени на лавандовом фоне. */
export function PsyAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Картинка могла упасть ещё до гидрации — тогда onError уже не придёт.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-label={name}
      className={cn(
        "flex items-center justify-center bg-brand-100 text-2xl font-bold text-brand-700",
        className,
      )}
    >
      {name.slice(0, 1)}
    </div>
  );
}
