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

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt: string;
  txHash?: string;
  transactionHash?: string;
}

function getWorldCupDeploymentsFilePath() {
  return path.resolve(process.cwd(), "data", "world-cup-deployments.json");
}

function readWorldCupDeployments(): WorldCupDeployment[] {
  try {
    const data = fs.readFileSync(getWorldCupDeploymentsFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(readWorldCupDeployments());
}
