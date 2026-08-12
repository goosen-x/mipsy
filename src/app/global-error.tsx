"use client";

import { useEffect } from "react";
import { reportClientError } from "./report-error";

/** Падение страницы: показываем человеческий экран и пишем в журнал ошибок. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message, error.digest, window.location.pathname);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Что-то пошло не так</h1>
        <p style={{ marginTop: "1rem", color: "#666" }}>
          Мы уже знаем о сбое. Попробуйте обновить страницу — а если не поможет, позвоните оператору.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.5rem",
            background: "#6f01c6",
            color: "#fff",
            border: 0,
            cursor: "pointer",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
