import "server-only";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";

/**
 * Проверка роли на каждой странице админки, а не только в layout: Next при
 * мягкой навигации не перерендеривает layout, поэтому авторизация обязана
 * жить рядом с данными. Посторонним — 404, как будто раздела нет.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) notFound();
}
