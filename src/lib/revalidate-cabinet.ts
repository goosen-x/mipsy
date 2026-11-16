import { revalidatePath } from "next/cache";

/** Разделы кабинета клиента: данные общие, поэтому сбрасываем все сразу. */
const CLIENT_CABINET_PATHS = ["/me", "/me/podbor", "/me/vstrechi", "/me/oplaty", "/me/podderzhka"];

export function revalidateClientCabinet() {
  for (const p of CLIENT_CABINET_PATHS) revalidatePath(p);
}
