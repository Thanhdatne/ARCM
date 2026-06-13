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

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Search, Wifi } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#2B3139] bg-[#0B0E11] px-3 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs text-[#707A8A] md:flex md:min-w-[280px] lg:min-w-[420px]">
            <Search className="h-3.5 w-3.5 text-[#FCD535]" />
            <span>Search ArcSignal markets</span>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs font-bold text-[#EAECEF] md:flex">
          <Wifi className="h-3.5 w-3.5 text-[#0ECB81]" />
          Arc Testnet / USDC gas
        </div>
        <div className="shrink-0">
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            chainStatus="name"
            showBalance={false}
          />
        </div>
      </div>
    </header>
  );
}
