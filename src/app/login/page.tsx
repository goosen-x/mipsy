import { redirect } from "next/navigation";
import { currentAccountId, homePathFor } from "@/lib/auth";
import { senderAddress } from "@/lib/mail";
import { LoginForm } from "./form";

export const metadata = { title: "Вход — mipsy" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const accountId = await currentAccountId();
  if (accountId) redirect(next?.startsWith("/") ? next : await homePathFor(accountId));

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <LoginForm next={next} sender={senderAddress()} />
    </div>
  );
}
