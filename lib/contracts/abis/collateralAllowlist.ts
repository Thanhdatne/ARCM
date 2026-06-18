export const COLLATERAL_ALLOWLIST_ABI = [
  {
    inputs: [{ name: "collateral", type: "address" }],
    name: "isCollateralAllowed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "collateral", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    name: "setCollateralAllowed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "collateral", type: "address" },
      { indexed: false, name: "allowed", type: "bool" },
    ],
    name: "CollateralAllowed",
    type: "event",
  },
] as const;
