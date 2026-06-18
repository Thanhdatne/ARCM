/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt?: string;
  txHash?: string;
  transactionHash?: string;
  contractVersion?: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  outcomeDecimals?: number;
}

function getContractVersion(deployment: WorldCupDeployment) {
  return deployment.contractVersion ?? 1;
}

function getWorldCupDeploymentsFilePath() {
  return path.resolve(process.cwd(), "data", "world-cup-deployments.json");
}

function readWorldCupDeployments(): WorldCupDeployment[] {
  try {
    const data = fs
      .readFileSync(getWorldCupDeploymentsFilePath(), "utf-8")
      .replace(/^\uFEFF/, "");
    const parsed = JSON.parse(data) as WorldCupDeployment[] | Record<string, WorldCupDeployment>;

    return Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch (error) {
    console.error("[world-cup/deployments] read failed", error);
    return [];
  }
}

export async function GET() {
  const hideLegacy = process.env.NEXT_PUBLIC_HIDE_LEGACY_V1 === "true";
  const deployments = readWorldCupDeployments();

  return NextResponse.json(
    hideLegacy
      ? deployments.filter((deployment) => getContractVersion(deployment) === 2)
      : deployments,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
