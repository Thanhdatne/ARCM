"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  Info,
  LoaderCircle,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { type Address, type EIP1193Provider } from "viem";
import { useAccount, useBalance } from "wagmi";
import {
  ArcTestnet,
  ArbitrumSepolia,
  BaseSepolia,
  BridgeKit,
  EthereumSepolia,
  OptimismSepolia,
  type BridgeResult,
} from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { arcTestnet } from "@/lib/wagmi";

const SOURCE_CHAINS = [
  {
    id: EthereumSepolia.chainId,
    label: "Ethereum Sepolia",
    bridgeId: "Ethereum_Sepolia" as const,
    logoSrc: "/brand/chains/ethereum-sepolia.jpg",
  },
  {
    id: BaseSepolia.chainId,
    label: "Base Sepolia",
    bridgeId: "Base_Sepolia" as const,
    logoSrc: "/brand/chains/base-sepolia.jpg",
  },
  {
    id: ArbitrumSepolia.chainId,
    label: "Arbitrum Sepolia",
    bridgeId: "Arbitrum_Sepolia" as const,
    logoSrc: "/brand/chains/arbitrum-sepolia.jpg",
  },
  {
    id: OptimismSepolia.chainId,
    label: "Optimism Sepolia",
    bridgeId: "Optimism_Sepolia" as const,
    logoSrc: "/brand/chains/optimism-sepolia.jpg",
  },
] as const;

const ARC_CHAIN_DISPLAY = {
  label: "Arc Testnet",
  logoSrc: "/brand/chains/arc-logo.png",
} as const;

const SDK_CHAINS = [
  EthereumSepolia,
  BaseSepolia,
  ArbitrumSepolia,
  OptimismSepolia,
  ArcTestnet,
];

const PROGRESS_STEPS = [
  "Approve",
  "Burn",
  "Attestation",
  "Mint",
  "Completed",
] as const;
type ProgressStep = (typeof PROGRESS_STEPS)[number];
type StepState = "idle" | "active" | "done" | "error";

function cleanError(error: unknown) {
  if (!(error instanceof Error)) return "The bridge could not be completed.";
  const message = error.message.split("\n")[0].trim();
  if (/user rejected|denied transaction signature/i.test(message)) {
    return "The wallet request was rejected. No bridge was completed.";
  }
  return message || "The bridge could not be completed.";
}

function validAmount(value: string) {
  return /^(?:0|[1-9]\d*)(?:\.\d{0,6})?$/.test(value) && Number(value) > 0;
}

export function DepositBridge() {
  const [isMounted, setIsMounted] = useState(false);
  const { connector } = useAccount();
  const { address, isConnected, walletType, connectMetaMask } = useWallet();
  const [sourceId, setSourceId] = useState<number>(EthereumSepolia.chainId);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [activeStep, setActiveStep] = useState<ProgressStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [isBridging, setIsBridging] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const source = useMemo(
    () =>
      SOURCE_CHAINS.find((chain) => chain.id === sourceId) ?? SOURCE_CHAINS[0],
    [sourceId],
  );
  const browserWalletReady =
    isConnected && walletType === "metamask" && !!address && !!connector;
  const amountIsValid = validAmount(amount);

  const arcBalance = useBalance({
    address,
    token: ArcTestnet.usdcAddress as Address,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  function advance(completed: ProgressStep, next: ProgressStep) {
    setCompletedSteps((steps) =>
      steps.includes(completed) ? steps : [...steps, completed],
    );
    setActiveStep(next);
  }

  async function bridge() {
    if (!browserWalletReady || !connector || !address || !amountIsValid) return;

    setError("");
    setResult(null);
    setCompletedSteps([]);
    setActiveStep("Approve");
    setIsBridging(true);

    try {
      const provider = (await connector.getProvider()) as EIP1193Provider;
      if (!provider)
        throw new Error(
          "The connected wallet did not expose an EIP-1193 provider.",
        );

      const adapter = await createViemAdapterFromProvider({
        provider,
        capabilities: {
          addressContext: "user-controlled",
          supportedChains: SDK_CHAINS,
        },
      });
      const kit = new BridgeKit({ disableErrorReporting: true });

      kit.on("approve", () => advance("Approve", "Burn"));
      kit.on("burn", () => advance("Burn", "Attestation"));
      kit.on("fetchAttestation", () => advance("Attestation", "Mint"));
      kit.on("mint", () => advance("Mint", "Completed"));

      const bridgeResult = await kit.bridge({
        from: { adapter, chain: source.bridgeId },
        to: {
          adapter,
          chain: "Arc_Testnet",
          recipientAddress: address,
        },
        amount,
        token: "USDC",
        config: {
          transferSpeed: "SLOW",
          batchTransactions: false,
        },
      });

      setResult(bridgeResult);
      if (bridgeResult.state !== "success") {
        const failedStep = bridgeResult.steps.find(
          (step) => step.state === "error",
        );
        throw new Error(
          failedStep?.errorMessage ||
            "Circle returned an incomplete bridge result.",
        );
      }

      setCompletedSteps([...PROGRESS_STEPS]);
      setActiveStep(null);
      await arcBalance.refetch();
    } catch (bridgeError) {
      setError(cleanError(bridgeError));
      setActiveStep((step) => step ?? "Approve");
    } finally {
      setIsBridging(false);
    }
  }

  const stateFor = (step: ProgressStep): StepState => {
    if (completedSteps.includes(step)) return "done";
    if (activeStep === step) return error ? "error" : "active";
    return "idle";
  };

  if (!isMounted) {
    return <DepositBridgeSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">
          Deposit
        </div>
        <div className="p-4 sm:p-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#EAECEF] sm:text-3xl">
            Bridge USDC to Arc Testnet
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#848E9C]">
            Move testnet USDC into your Arc wallet for trading ARCM markets.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="exchange-panel overflow-hidden">
          <div className="terminal-titlebar px-3 py-2 text-sm font-bold">
            Bridge route
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="relative">
              <span
                id="source-chain-label"
                className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#848E9C]"
              >
                From network
              </span>
              <button
                type="button"
                aria-labelledby="source-chain-label"
                aria-expanded={sourceMenuOpen}
                disabled={isBridging}
                onClick={() => setSourceMenuOpen((open) => !open)}
                className="focus-ring flex h-12 w-full items-center justify-between rounded-md border border-[#2B3139] bg-[#181A20] px-3 text-left text-sm font-semibold text-[#EAECEF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ChainIdentity chain={source} />
                <ChevronDown
                  className={`h-4 w-4 text-[#848E9C] transition-transform ${sourceMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {sourceMenuOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-[#2B3139] bg-[#181A20] shadow-2xl shadow-black/40">
                  {SOURCE_CHAINS.map((chain) => {
                    const selected = chain.id === sourceId;
                    return (
                      <button
                        key={chain.id}
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold transition ${selected ? "bg-[#FCD535]/10 text-[#FCD535]" : "text-[#EAECEF] hover:bg-[#2B3139]"}`}
                        onClick={() => {
                          setSourceId(chain.id);
                          setSourceMenuOpen(false);
                        }}
                      >
                        <ChainIdentity chain={chain} />
                        {selected ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex justify-center text-[#707A8A]">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#848E9C]">
                To network
              </span>
              <div className="flex h-12 items-center justify-between rounded-md border border-[#2B3139] bg-[#181A20] px-3">
                <ChainIdentity chain={ARC_CHAIN_DISPLAY} />
                <span className="text-xs font-bold text-[#FCD535]">Locked</span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#848E9C]">
                Token
              </span>
              <div className="flex h-12 items-center justify-between rounded-md border border-[#2B3139] bg-[#181A20] px-3">
                <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#EAECEF]">
                  <TokenLogo /> USDC
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#707A8A]">
                  Circle CCTP
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="bridge-amount"
                className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#848E9C]"
              >
                Amount
              </label>
              <div className="flex h-12 items-center rounded-md border border-[#2B3139] bg-[#181A20] focus-within:border-[#FCD535]">
                <input
                  id="bridge-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  disabled={isBridging}
                  onChange={(event) => setAmount(event.target.value.trim())}
                  aria-describedby="amount-help"
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-[#EAECEF] outline-none placeholder:text-[#5E6673]"
                />
                <span className="border-l border-[#2B3139] px-3 text-sm font-bold text-[#FCD535]">
                  USDC
                </span>
              </div>
              <p id="amount-help" className="mt-2 text-xs text-[#707A8A]">
                Up to 6 decimal places. Source-chain gas is paid in that
                chain&apos;s testnet gas token.
              </p>
            </div>

            {!browserWalletReady ? (
              <Button
                type="button"
                className="h-11 w-full bg-[#FCD535] font-bold text-[#181A20] hover:bg-[#EBC62F]"
                onClick={connectMetaMask}
              >
                <WalletCards className="h-4 w-4" /> Connect browser wallet
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 w-full bg-[#FCD535] font-bold text-[#181A20] hover:bg-[#EBC62F]"
                disabled={!amountIsValid || isBridging}
                onClick={() => void bridge()}
              >
                {isBridging ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CircleDot className="h-4 w-4" />
                )}
                {isBridging
                  ? "Bridge in progress…"
                  : `Bridge ${amountIsValid ? amount : ""} USDC to Arc`}
              </Button>
            )}

            {walletType === "circle" ? (
              <Notice
                tone="warning"
                text="Circle passkey wallets are Arc-only in this app. Connect an EIP-1193 browser wallet holding source-chain USDC to bridge."
              />
            ) : null}
            {amount && !amountIsValid ? (
              <Notice
                tone="warning"
                text="Enter a USDC amount greater than zero with no more than 6 decimal places."
              />
            ) : null}
            {error ? <Notice tone="error" text={error} /> : null}
            {result?.state === "success" ? (
              <Notice
                tone="success"
                text={`${result.amount} USDC was minted to your wallet on Arc Testnet.`}
              />
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="exchange-panel">
            <div className="terminal-titlebar flex items-center justify-between px-3 py-2 text-sm font-bold">
              <span>Arc USDC balance</span>
              <button
                type="button"
                aria-label="Refresh Arc USDC balance"
                onClick={() => void arcBalance.refetch()}
                disabled={!address || arcBalance.isFetching}
                className="focus-ring rounded p-1 text-[#848E9C] hover:text-[#FCD535] disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${arcBalance.isFetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="p-4">
              <p className="text-2xl font-bold text-[#EAECEF]">
                {address
                  ? arcBalance.data
                    ? `${Number(arcBalance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`
                    : "Checking…"
                  : "Connect wallet"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#707A8A]">
                ERC-20 USDC available to the connected wallet on Arc Testnet.
              </p>
            </div>
          </section>

          <section className="exchange-panel" aria-live="polite">
            <div className="terminal-titlebar px-3 py-2 text-sm font-bold">
              Bridge progress
            </div>
            <ol className="space-y-1 p-3">
              {PROGRESS_STEPS.map((step) => (
                <ProgressRow key={step} label={step} state={stateFor(step)} />
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section className="exchange-panel p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#FCD535]" />
          <div>
            <h2 className="text-sm font-bold text-[#EAECEF]">
              Gateway is future advanced routing
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#848E9C]">
              Gateway unified balance is not required to trade ARCM markets
              today. This deposit sends ERC-20 USDC directly to your own Arc
              Testnet wallet; no Gateway deposit action is exposed.
            </p>
            <a
              href="https://developers.circle.com/bridge-kit"
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#FCD535] hover:underline"
            >
              Circle Bridge Kit documentation{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChainIdentity({
  chain,
}: {
  chain: { label: string; logoSrc: string };
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ChainLogo src={chain.logoSrc} label={chain.label} />
      <span className="truncate">{chain.label}</span>
    </span>
  );
}

function ChainLogo({ src, label }: { src: string; label: string }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border border-[#2B3139] bg-[#0B0E11]">
      <img
        src={src}
        alt={`${label} logo`}
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function TokenLogo() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full border border-[#2B3139] bg-[#0B0E11]">
      <img
        src="/brand/tokens/usdc.jpg"
        alt="USDC logo"
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function DepositBridgeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">
          Deposit
        </div>
        <div className="p-4 sm:p-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#EAECEF] sm:text-3xl">
            Bridge USDC to Arc Testnet
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#848E9C]">
            Move testnet USDC into your Arc wallet for trading ARCM markets.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="exchange-panel overflow-hidden">
          <div className="terminal-titlebar px-3 py-2 text-sm font-bold">
            Bridge route
          </div>
          <div className="space-y-4 p-4 sm:p-5" aria-hidden="true">
            <SkeletonBlock label="From" />
            <div className="flex justify-center text-[#707A8A]">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </div>
            <SkeletonBlock label="To" />
            <SkeletonBlock label="Amount" />
            <div className="h-11 w-full rounded-md bg-[#FCD535]/70" />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="exchange-panel">
            <div className="terminal-titlebar px-3 py-2 text-sm font-bold">
              Arc USDC balance
            </div>
            <div className="p-4" aria-hidden="true">
              <div className="h-8 w-40 rounded-md bg-[#2B3139]" />
              <div className="mt-3 h-4 w-full rounded bg-[#2B3139]" />
            </div>
          </section>

          <section className="exchange-panel">
            <div className="terminal-titlebar px-3 py-2 text-sm font-bold">
              Bridge progress
            </div>
            <ol className="space-y-1 p-3" aria-hidden="true">
              {PROGRESS_STEPS.map((step) => (
                <ProgressRow key={step} label={step} state="idle" />
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SkeletonBlock({ label }: { label: string }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#848E9C]">
        {label}
      </span>
      <div className="h-12 w-full rounded-md border border-[#2B3139] bg-[#181A20]" />
    </div>
  );
}

function ProgressRow({
  label,
  state,
}: {
  label: ProgressStep;
  state: StepState;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm ${state === "active" ? "border-[#FCD535] bg-[#FCD535]/5 text-[#EAECEF]" : state === "error" ? "border-[#F6465D]/50 bg-[#F6465D]/5 text-[#F6465D]" : "border-transparent text-[#707A8A]"}`}
    >
      {state === "done" ? (
        <Check className="h-4 w-4 text-[#0ECB81]" />
      ) : state === "active" ? (
        <LoaderCircle className="h-4 w-4 animate-spin text-[#FCD535]" />
      ) : state === "error" ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-[#474D57]" />
      )}
      <span className="font-semibold">{label}</span>
    </li>
  );
}

function Notice({
  tone,
  text,
}: {
  tone: "warning" | "error" | "success";
  text: string;
}) {
  const styles =
    tone === "success"
      ? "border-[#0ECB81]/40 bg-[#0ECB81]/5 text-[#84DDB8]"
      : tone === "error"
        ? "border-[#F6465D]/40 bg-[#F6465D]/5 text-[#FF9BA8]"
        : "border-[#FCD535]/30 bg-[#FCD535]/5 text-[#D6C36B]";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2.5 text-xs leading-5 ${styles}`}
    >
      {text}
    </div>
  );
}
