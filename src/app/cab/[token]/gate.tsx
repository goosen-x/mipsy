"use client";

import { AccessGate } from "@/components/access-gate";
import { confirmPsyCode, sendPsyCode } from "./access";

export function PsyGate({ token }: { token: string }) {
  return (
    <AccessGate
      hint="видны ваши документы, расписание и записи клиентов"
      onSend={() => sendPsyCode(token)}
      onCheck={(code) => confirmPsyCode(token, code)}
    />
  );
}
