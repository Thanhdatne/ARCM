import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { scanWalletPositions } from "@/lib/world-cup/scanWalletPositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("address");

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json(
      { error: "Valid wallet address is required.", markets: [], scanned: 0, settled: 0, withWinningBalance: 0 },
      { status: 400 },
    );
  }

  try {
    const debug = url.searchParams.get("debug") === "1";
    const scan = await scanWalletPositions(
      wallet as Address,
      url.searchParams.get("refresh") === "1",
      debug,
      { mode: url.searchParams.get("full") === "1" ? "full" : "fast" },
    );
    const markets = scan.claimablePositions.map((position) => ({
      id: position.id,
      fixtureId: position.fixtureId,
      group: position.group,
      title: position.title,
      address: position.address,
      ammAddress: position.ammAddress,
      winningSide: position.winningSide ?? "Mixed",
      claimLongAmount: position.claimLongAmount,
      claimShortAmount: position.claimShortAmount,
      payoutAmount: position.claimablePayout,
      payoutAmountFormatted: position.claimablePayoutFormatted,
      yesBalance: position.yesBalance,
      noBalance: position.noBalance,
      collateralAddress: position.collateralAddress,
      collateralSymbol: position.collateralSymbol,
      collateralName: position.collateralName,
      collateralDecimals: position.collateralDecimals,
      collateralWarning: position.collateralWarning,
      contractVersion: position.contractVersion,
      outcomeDecimals: position.outcomeDecimals,
    }));

    return NextResponse.json(
      {
        success: true,
        source: "onchain_scan",
        scanned: scan.scanned,
        settled: scan.settledMarketCount,
        failed: scan.failed,
        ...(debug && scan.debug
          ? {
              scanMode: scan.debug.scanMode,
              totalAvailableMarkets: scan.debug.totalAvailableMarkets,
              skippedByFastMode: scan.debug.skippedByFastMode,
            }
          : {}),
        withWinningBalance: markets.length,
        markets,
        ...(debug && scan.debug ? { debug: scan.debug } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to scan claimable rewards.", markets: [], scanned: 0, settled: 0, withWinningBalance: 0 },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
