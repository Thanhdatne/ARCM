const createMarketParams = [
  { name: "pairName", type: "string" },
  { name: "collateralToken", type: "address" },
  { name: "customAncillaryData", type: "bytes" },
  { name: "proposerReward", type: "uint256" },
  { name: "optimisticOracleLivenessTime", type: "uint256" },
  { name: "optimisticOracleProposerBond", type: "uint256" },
  { name: "initialLiquidity", type: "uint256" },
  { name: "feeBps", type: "uint256" },
] as const;

export const MARKET_V2_FACTORY_ABI = [
  {
    inputs: [{ components: createMarketParams, name: "params", type: "tuple" }],
    name: "createMarket",
    outputs: [
      { name: "marketAddress", type: "address" },
      { name: "ammAddress", type: "address" },
    ],
    stateMutability: "nonpayable",
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
    name: "pairCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "pairId", type: "uint256" }],
    name: "getPair",
    outputs: [
      {
        components: [
          { name: "market", type: "address" },
          { name: "amm", type: "address" },
          { name: "creator", type: "address" },
          { name: "collateral", type: "address" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "market", type: "address" }],
    name: "getAmmForMarket",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amm", type: "address" }],
    name: "getMarketForAmm",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "pairId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "market", type: "address" },
      { indexed: false, name: "amm", type: "address" },
      { indexed: false, name: "collateral", type: "address" },
      { indexed: false, name: "collateralDecimals", type: "uint8" },
      { indexed: false, name: "initialLiquidity", type: "uint256" },
      { indexed: false, name: "feeBps", type: "uint256" },
    ],
    name: "MarketCreated",
    type: "event",
  },
] as const;
