import { MARKET_ABI } from "./market";

export const EVENT_BASED_PREDICTION_MARKET_V2_ABI = [
  ...MARKET_ABI,
  {
    inputs: [],
    name: "contractVersion",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "collateralDecimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "outcomeDecimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "collateralAllowlist",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "finder",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const MARKET_V2_ABI = EVENT_BASED_PREDICTION_MARKET_V2_ABI;
