const viewAddress = (name: string) => ({
  inputs: [],
  name,
  outputs: [{ name: "", type: "address" }],
  stateMutability: "view",
  type: "function",
} as const);

const viewUint = (name: string, type = "uint256") => ({
  inputs: [],
  name,
  outputs: [{ name: "", type }],
  stateMutability: "view",
  type: "function",
} as const);

const quote = (name: string, inputName: string) => ({
  inputs: [{ name: inputName, type: "uint256" }],
  name,
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
  type: "function",
} as const);

const trade = (name: string, inputName: string, outputName: string) => ({
  inputs: [
    { name: inputName, type: "uint256" },
    { name: "minOut", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  name,
  outputs: [{ name: outputName, type: "uint256" }],
  stateMutability: "nonpayable",
  type: "function",
} as const);

export const PREDICTION_MARKET_AMM_V2_ABI = [
  viewAddress("market"),
  viewAddress("collateralToken"),
  viewAddress("longToken"),
  viewAddress("shortToken"),
  viewAddress("initializer"),
  viewUint("collateralDecimals", "uint8"),
  viewUint("outcomeDecimals", "uint8"),
  viewUint("feeBps"),
  viewUint("reserveYes"),
  viewUint("reserveNo"),
  {
    inputs: [],
    name: "initialized",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "provider", type: "address" },
      { name: "initialLiquidity", type: "uint256" },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  trade("buyYes", "collateralIn", "yesOut"),
  trade("buyNo", "collateralIn", "noOut"),
  trade("sellYes", "yesIn", "collateralOut"),
  trade("sellNo", "noIn", "collateralOut"),
  quote("calcBuyYes", "collateralIn"),
  quote("calcBuyNo", "collateralIn"),
  quote("calcSellYes", "yesIn"),
  quote("calcSellNo", "noIn"),
  viewUint("getYesPrice"),
  viewUint("getNoPrice"),
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const AMM_V2_ABI = PREDICTION_MARKET_AMM_V2_ABI;
