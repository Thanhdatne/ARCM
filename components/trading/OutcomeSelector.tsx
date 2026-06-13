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

type Outcome = "yes" | "no";

interface OutcomeSelectorProps {
  outcome: Outcome;
  onSelect: (outcome: Outcome) => void;
  label?: string;
  yesPrice?: number;
  noPrice?: number;
}

export function OutcomeSelector({
  outcome,
  onSelect,
  label = "Outcome",
  yesPrice,
  noPrice,
}: OutcomeSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[#707A8A]">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onSelect("yes")}
          className={`focus-ring rounded-2xl border px-3 py-3 text-left transition active:translate-y-px ${
            outcome === "yes"
              ? "border-[#0ECB81] bg-[#0ECB81] text-white"
              : "border-[#2B3139] bg-[#0B0E11] text-[#EAECEF] hover:-translate-y-px hover:border-[#0ECB81] hover:bg-[#0ECB81]/15"
          }`}
        >
          <span className="block text-xs font-black uppercase tracking-[0.06em]">
            YES
          </span>
          <span className="mt-1 block font-mono text-2xl font-black leading-none">
            {yesPrice !== undefined ? `${Math.round(yesPrice)}c` : "--"}
          </span>
        </button>
        <button
          onClick={() => onSelect("no")}
          className={`focus-ring rounded-2xl border px-3 py-3 text-left transition active:translate-y-px ${
            outcome === "no"
              ? "border-[#F6465D] bg-[#F6465D] text-white"
              : "border-[#2B3139] bg-[#0B0E11] text-[#EAECEF] hover:-translate-y-px hover:border-[#F6465D] hover:bg-[#F6465D]/15"
          }`}
        >
          <span className="block text-xs font-black uppercase tracking-[0.06em]">
            NO
          </span>
          <span className="mt-1 block font-mono text-2xl font-black leading-none">
            {noPrice !== undefined ? `${Math.round(noPrice)}c` : "--"}
          </span>
        </button>
      </div>
    </div>
  );
}
