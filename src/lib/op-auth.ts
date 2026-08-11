import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const OP_COOKIE = "mipsy_op";

export function opPasswordHash(): string | null {
  const pwd = process.env.OPERATOR_PASSWORD;
  if (!pwd) return null;
  return createHash("sha256").update(pwd).digest("hex");
}

export async function isOperator(): Promise<boolean> {
  const hash = opPasswordHash();
  if (!hash) return false;
  const store = await cookies();
  return store.get(OP_COOKIE)?.value === hash;
}
