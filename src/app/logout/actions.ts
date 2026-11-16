"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";

export async function signOutAction() {
  await signOut();
  // Шапка живёт в лейауте и сама не перерисуется — сбрасываем кэш всего сайта.
  revalidatePath("/", "layout");
  redirect("/");
}
