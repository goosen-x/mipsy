import { redirect } from "next/navigation";
import { currentAccountId, homePathFor } from "@/lib/auth";
import { HeaderLockup } from "@/components/logo";
import { LoginForm } from "./form";

export const metadata = { title: "Вход — mipsy" };
export const dynamic = "force-dynamic";

// Раскладка — по блоку shadcn login-02: слева логотип и форма, справа фото.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const accountId = await currentAccountId();
  if (accountId) redirect(next?.startsWith("/") ? next : await homePathFor(accountId));

  return (
    <div className="grid min-h-svh lg:grid-cols-[2fr_3fr]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <HeaderLockup />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm next={next} />
          </div>
        </div>
      </div>
      {/* Фото — только на широких экранах; на телефоне форма во всю ширину. */}
      <div className="hidden p-4 lg:block xl:p-6">
        <div className="relative h-full overflow-hidden rounded-3xl bg-brand-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/login-session.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
