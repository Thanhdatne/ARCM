import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { COLLATERAL_DECIMALS } from "@/lib/contracts";
import { scanWalletPositions } from "@/lib/world-cup/scanWalletPositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("address");

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json(
      { error: "Valid wallet address is required.", arctBalance: "0", positions: [] },
      { status: 400 },
    );
  }

  try {
    const scan = await scanWalletPositions(wallet as Address, url.searchParams.get("refresh") === "1");
    const positions = [...scan.openPositions, ...scan.settledPositions];
    const sideCount = positions.reduce(
      (total, position) => total + (BigInt(position.yesBalance) > 0n ? 1 : 0) + (BigInt(position.noBalance) > 0n ? 1 : 0),
      0,
    );

    return NextResponse.json(
      {
        success: true,
        decimals: COLLATERAL_DECIMALS,
        scanned: scan.scanned,
        failed: scan.failed,
        arctBalance: "0",
        positions,
        totals: {
          marketsWithPositions: positions.length,
          openPositions: scan.openPositions.length,
          settledPositions: scan.settledPositions.length,
          sideCount,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to scan wallet positions.", arctBalance: "0", positions: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
