/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { parseTxError } from "@/lib/errors";

export interface TxStatusProps {
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  hash: `0x${string}` | undefined;
}

export function TxStatus({
  isPending,
  isConfirming,
  isSuccess,
  error,
  hash,
}: TxStatusProps) {
  if (isPending)
    return <p className="rounded-xl border border-[#FCD535]/60 bg-[#FCD535]/15 px-3 py-2 text-xs font-bold text-[#FFF3AF]">Confirm in wallet...</p>;
  if (isConfirming)
    return <p className="rounded-xl border border-[#FCD535]/60 bg-[#FCD535]/15 px-3 py-2 text-xs font-bold text-[#FFF3AF]">Waiting for confirmation...</p>;
  if (isSuccess && hash) {
    return (
      <p className="rounded-xl border border-[#0ECB81]/60 bg-[#0ECB81]/15 px-3 py-2 text-xs font-bold text-[#BFFFE7]">
        Success!{" "}
        <a
          href={`https://testnet.arcscan.app/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="interactive-link font-black"
        >
          View tx
        </a>
      </p>
    );
  }
  if (error) {
    const { title, detail } = parseTxError(error);
    return (
      <div className="rounded-xl border border-[#F6465D] bg-[#F6465D]/15 px-3 py-2 text-xs text-[#FFD7DD]">
        <p className="font-bold">{title}</p>
        {detail && <p className="mt-0.5 text-[#FCA5A5]">{detail}</p>}
      </div>
    );
  }
  return null;
}
