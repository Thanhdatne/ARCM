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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Plus, TriangleAlert } from "lucide-react";
import { parseTxError } from "@/lib/errors";
import { useWallet } from "@/contexts/WalletContext";
import { arcTestnet } from "@/lib/wagmi";
import { cn } from "@/lib/utils";

interface CreateMarketDialogProps {
  onCreated: (market?: CreatedMarket) => void | Promise<void>;
  triggerClassName?: string;
  triggerLabel?: string;
  initialTitle?: string;
  initialCategory?: string;
  initialSettlementRule?: string;
  fixtureId?: string;
  group?: string;
  outcomeType?: string;
  worldCupMarketId?: string;
  redirectOnCreated?: boolean;
  adminKey?: string;
}

interface CreatedMarket {
  id: string;
  address: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
}

interface CreateMarketResponse {
  success?: boolean;
  market?: CreatedMarket;
  error?: string;
}

type CreateState = "idle" | "pending" | "confirmed" | "failed";

export function CreateMarketDialog({
  onCreated,
  triggerClassName,
  triggerLabel = "Create Market",
  initialTitle = "",
  initialCategory,
  initialSettlementRule,
  fixtureId,
  group,
  outcomeType,
  worldCupMarketId,
  redirectOnCreated = true,
  adminKey,
}: CreateMarketDialogProps) {
  const router = useRouter();
  const { isConnected, walletType } = useWallet();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateState>("idle");
  const [step, setStep] = useState<string | null>(null);
  const [storedAdminKey, setStoredAdminKey] = useState("");

  useEffect(() => {
    setStoredAdminKey(window.localStorage.getItem("ARCM-admin-key") ?? "");
  }, []);

  const wrongNetwork = isConnected && walletType === "metamask" && chainId !== arcTestnet.id;
  const canSubmit = isConnected && !wrongNetwork && !!title.trim() && !isCreating;

  const resetStatus = () => {
    setError(null);
    setFieldError(null);
    setCreateState("idle");
    setStep(null);
  };

  const handleCreate = async () => {
    if (!isConnected) {
      setError({
        title: "Wallet not connected",
        detail: "Connect a wallet before creating a real Arc Testnet market.",
      });
      return;
    }

    if (wrongNetwork) {
      setError({
        title: "Wrong network",
        detail: "Switch your wallet to Arc Testnet before submitting the deployment request.",
      });
      return;
    }

    if (!title.trim()) {
      setFieldError("Market question is required.");
      return;
    }

    setIsCreating(true);
    setError(null);
    setFieldError(null);
    setCreateState("pending");
    setStep("Sending market creation request...");

    try {
      const activeAdminKey = (adminKey ?? storedAdminKey).trim();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeAdminKey) headers["x-admin-key"] = activeAdminKey;

      const res = await fetch("/api/create-market", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          category: initialCategory,
          settlementRule: initialSettlementRule,
          fixtureId,
          group,
          outcomeType,
          worldCupMarketId,
        }),
      });

      setStep("Creating the market, preparing settlement, and adding starting liquidity...");

      const data = (await res.json()) as CreateMarketResponse;

      if (!res.ok) {
        throw new Error(data.error || "Failed to create market");
      }

      setCreateState("confirmed");
      setStep("Market confirmed. Refreshing markets...");
      setTitle("");
      await onCreated(data.market);

      if (!redirectOnCreated) {
        setStep(data.market?.address
          ? "Market confirmed. Trade on Arc is now available for this card."
          : "Market confirmed. Refresh the market board if the card does not update.");
      } else if (data.market?.address) {
        setStep("Opening created market...");
        router.push(`/market/${data.market.address}`);
        setOpen(false);
      } else {
        setStep("Market confirmed. Returning to Markets...");
        router.push("/");
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to create market");
      setError(parseTxError(e));
      setCreateState("failed");
      setStep(null);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setTitle(initialTitle);
        if (!v) resetStatus();
      }}
    >
      <DialogTrigger
        render={
          <button
            className={cn("terminal-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-bold", triggerClassName)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            {triggerLabel}
          </button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Prediction Market</DialogTitle>
          <DialogDescription>
            Deploy a real Arc Testnet prediction market with ARCT test collateral.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-[#EAECEF]">
          {!isConnected && (
            <div className="rounded-lg border border-[#FCD535] bg-[#FCD535]/15 p-3">
              <div className="mb-3 flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 text-[#FCD535]" />
                <div>
                  <p className="text-sm font-bold">Connect wallet first</p>
                  <p className="mt-1 text-xs text-[#707A8A]">
                    Wallet connection is required before creating an onchain market.
                  </p>
                </div>
              </div>
              <ConnectButton showBalance={false} chainStatus="name" />
            </div>
          )}

          {wrongNetwork && (
            <div className="rounded-lg border border-[#F6465D] bg-[#F6465D]/15 p-3 text-sm">
              <p className="font-bold">Wrong network</p>
              <p className="mt-1 text-xs">
                Switch to Arc Testnet in RainbowKit before submitting. Gas is paid in Arc Testnet USDC.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#707A8A]">
              Market Question
            </label>
            <Input
              placeholder="e.g. Will BTC close above its weekly high?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) handleCreate();
              }}
            />
            {fieldError && (
              <p className="mt-1.5 text-xs font-bold text-[#F43F5E]">{fieldError}</p>
            )}
          </div>

          <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-3 text-xs leading-5 text-[#707A8A]">
            Your market will use ARCT test collateral, Arc Testnet USDC gas, and UMA OO V2 settlement.
            After creation, ARCM opens the market detail page so users can trade YES or NO.
          </div>

          {(initialCategory || initialSettlementRule) && (
            <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] p-3 text-xs leading-5 text-[#707A8A]">
              {initialCategory && (
                <p>
                  <span className="font-bold text-[#EAECEF]">Category:</span> {initialCategory}
                </p>
              )}
              {initialSettlementRule && (
                <p className="mt-1">
                  <span className="font-bold text-[#EAECEF]">Settlement rule:</span> {initialSettlementRule}
                </p>
              )}
            </div>
          )}

          <CreateProgress state={createState} step={step} />

          {step && (
            <div className="flex items-center gap-2 text-sm font-bold text-[#FCD535]">
              {createState === "confirmed" ? (
                <CheckCircle2 className="h-4 w-4 text-[#16C784]" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {step}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#F6465D] bg-[#F6465D]/15 px-3 py-2 text-sm text-[#F6465D]">
              <p className="font-medium">{error.title}</p>
              {error.detail && <p className="mt-0.5 text-xs">{error.detail}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="w-full sm:w-auto"
          >
            {isCreating ? "Creating on Arc Testnet..." : "Create Market"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProgress({
  state,
  step,
}: {
  state: CreateState;
  step: string | null;
}) {
  const steps = [
    "Connect wallet",
    "Fill market question",
    "Submit deployment request",
    "Wait for confirmations",
    "Open market detail",
  ];
  const activeIndex = state === "confirmed" ? 4 : state === "pending" ? 3 : 1;

  return (
    <div className="grid gap-1 rounded-lg border border-[#2B3139] bg-[#0B0E11] p-1 text-xs font-bold">
      {steps.map((label, index) => {
        const complete = state === "confirmed" || index < activeIndex;
        const active = state === "pending" && index === activeIndex;
        const failed = state === "failed" && index >= 2;

        return (
          <div
            className={`flex items-center justify-between px-3 py-2 ${
              active ? "bg-[#FCD535] text-[#181A20]" : complete ? "bg-[#0ECB81]/15 text-[#BFFFE7]" : "bg-[#1E2329]"
            } ${failed ? "bg-[#F6465D]/15 text-[#F6465D]" : "text-[#EAECEF]"}`}
            key={label}
          >
            <span>{label}</span>
            <span>{complete ? "OK" : active ? "..." : "--"}</span>
          </div>
        );
      })}
      {step && <div className="px-3 py-2 text-[11px] font-normal text-[#707A8A]">{step}</div>}
    </div>
  );
}

