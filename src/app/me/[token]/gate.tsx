"use client";

import { AccessGate } from "@/components/access-gate";
import { confirmClientCode, sendClientCode } from "./access";

export function ClientGate({ token }: { token: string }) {
  return (
    <AccessGate
      hint="видно, что вы рассказали о себе, и с каким психологом работаете"
      onSend={() => sendClientCode(token)}
      onCheck={(code) => confirmClientCode(token, code)}
    />
  );
}
