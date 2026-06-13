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

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/contexts/WalletContext";
import { ARCT_ADDRESS } from "@/lib/contracts";
import { useMintArct } from "@/hooks/useMarket";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function ArctFaucetButton() {
  const { isConnected } = useWallet();
  const queryClient = useQueryClient();
  const mintArct = useMintArct();
  const arctConfigured = ARCT_ADDRESS !== ZERO_ADDRESS;

  useEffect(() => {
    if (mintArct.isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [mintArct.isSuccess, queryClient]);

  if (!isConnected) return null;

  return (
    <div className="mt-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#EAECEF]">ARCT faucet</p>
          <p className="text-[11px] text-[#707A8A]">
            Mint ARCT test collateral for trading.
          </p>
        </div>
        <button
          className="terminal-surface px-3 py-1.5 text-xs font-bold text-[#EAECEF] disabled:cursor-not-allowed disabled:text-[#707A8A]"
          disabled={!arctConfigured || mintArct.isPending || mintArct.isConfirming}
          onClick={() => mintArct.mint("1000")}
          type="button"
        >
          {mintArct.isPending || mintArct.isConfirming ? "Minting..." : "Faucet 1000 ARCT"}
        </button>
      </div>
      {!arctConfigured && (
        <p className="mt-2 text-[11px] font-bold text-[#F43F5E]">
          Configure NEXT_PUBLIC_ARCT_ADDRESS before minting collateral.
        </p>
      )}
      {mintArct.isSuccess && (
        <p className="mt-2 text-[11px] font-bold text-[#22C55E]">
          ARCT mint transaction confirmed.
        </p>
      )}
      {mintArct.error && (
        <p className="mt-2 text-[11px] font-bold text-[#F43F5E]">
          Faucet failed: {mintArct.error.message}
        </p>
      )}
    </div>
  );
}
