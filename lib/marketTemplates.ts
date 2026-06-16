export type MarketTemplateCategory =
  | "Arc"
  | "Crypto"
  | "Stablecoins"
  | "AI"
  | "Macro"
  | "RWA"
  | "Privacy";

export type MarketTemplate = {
  id: string;
  title: string;
  category: MarketTemplateCategory;
  settlementRule: string;
  source: string;
  endDate: string;
  riskLevel: "Low" | "Medium" | "High";
};

export const MARKET_TEMPLATES: MarketTemplate[] = [
  // Crypto
  {
    id: "eth-above-4000-2026-06-30",
    title: "Will ETH close above $4,000 on June 30, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if ETH/USD daily candle close is strictly above 4000 on the selected source for June 30, 2026 UTC. Otherwise NO.",
    source: "Coinbase ETH/USD daily close",
    endDate: "2026-06-30",
    riskLevel: "Medium",
  },
  {
    id: "btc-above-120000-2026-06-30",
    title: "Will BTC close above $120,000 on June 30, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if BTC/USD daily candle close is strictly above 120000 on the selected source for June 30, 2026 UTC. Otherwise NO.",
    source: "Coinbase BTC/USD daily close",
    endDate: "2026-06-30",
    riskLevel: "Medium",
  },
  {
    id: "sol-above-250-2026-06-30",
    title: "Will SOL close above $250 on June 30, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if SOL/USD daily candle close is strictly above 250 on the selected source for June 30, 2026 UTC. Otherwise NO.",
    source: "Coinbase SOL/USD daily close",
    endDate: "2026-06-30",
    riskLevel: "Medium",
  },
  {
    id: "eth-btc-ratio-above-005-2026-06-30",
    title: "Will ETH/BTC close above 0.05 on June 30, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if the ETH/BTC daily close is strictly above 0.05 on the selected source for June 30, 2026 UTC. Otherwise NO.",
    source: "Binance or Coinbase ETH/BTC daily close",
    endDate: "2026-06-30",
    riskLevel: "High",
  },

  // Stablecoins
  {
    id: "usdc-hold-peg-2026-06-30",
    title: "Will USDC stay above $0.995 through June 30, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if USDC/USD never trades below 0.995 on the selected source from market open through June 30, 2026 UTC. Otherwise NO.",
    source: "Coinbase USDC/USD or selected stablecoin price feed",
    endDate: "2026-06-30",
    riskLevel: "Low",
  },
  {
    id: "usdt-depeg-below-099-2026-q2",
    title: "Will USDT trade below $0.99 before July 1, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if USDT/USD trades below 0.99 at any time on the selected source before July 1, 2026 00:00 UTC. Otherwise NO.",
    source: "Selected USDT/USD spot market",
    endDate: "2026-07-01",
    riskLevel: "Medium",
  },
  {
    id: "usdc-supply-above-100b-2026-12-31",
    title: "Will USDC circulating supply exceed $100B by Dec 31, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if the official published USDC circulating supply is greater than 100 billion USD by Dec 31, 2026 23:59 UTC. Otherwise NO.",
    source: "Official USDC transparency / supply dashboard",
    endDate: "2026-12-31",
    riskLevel: "Medium",
  },

  // AI
  {
    id: "openai-release-major-model-2026-q3",
    title: "Will OpenAI release a new major frontier model before Oct 1, 2026?",
    category: "AI",
    settlementRule:
      "YES if OpenAI officially announces and releases a new major frontier model to the public or API before Oct 1, 2026 00:00 UTC. Otherwise NO.",
    source: "OpenAI official announcement or docs",
    endDate: "2026-10-01",
    riskLevel: "High",
  },
  {
    id: "nvidia-close-above-200-2026-06-30",
    title: "Will NVIDIA close above $200 on June 30, 2026?",
    category: "AI",
    settlementRule:
      "YES if NVIDIA common stock closes strictly above 200 USD on the primary exchange for June 30, 2026 local market time. Otherwise NO.",
    source: "NASDAQ official close / major market data source",
    endDate: "2026-06-30",
    riskLevel: "Medium",
  },
  {
    id: "ai-agent-top-appstore-2026",
    title: "Will an AI agent app reach #1 in the US App Store before 2027?",
    category: "AI",
    settlementRule:
      "YES if an app marketed primarily as an AI agent reaches #1 overall free or paid ranking in the US App Store before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Apple App Store ranking archive or trusted app ranking source",
    endDate: "2027-01-01",
    riskLevel: "High",
  },
  {
    id: "ai-video-model-public-2026-q4",
    title: "Will a public AI video model generate 60s clips before 2027?",
    category: "AI",
    settlementRule:
      "YES if a publicly available AI video generation product supports text-to-video clips of at least 60 seconds before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Official product documentation or launch announcement",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },

  // Macro
  {
    id: "fed-cut-rate-before-2026-12-31",
    title: "Will the Fed cut rates at least once before Dec 31, 2026?",
    category: "Macro",
    settlementRule:
      "YES if the Federal Reserve target range is lowered at any scheduled or unscheduled FOMC decision before Dec 31, 2026 23:59 ET. Otherwise NO.",
    source: "Federal Reserve FOMC statements",
    endDate: "2026-12-31",
    riskLevel: "Medium",
  },
  {
    id: "us-cpi-under-3-2026-09",
    title: "Will US CPI YoY be below 3.0% for September 2026?",
    category: "Macro",
    settlementRule:
      "YES if the official US CPI YoY reading for September 2026 is below 3.0% in the initial BLS release. Otherwise NO.",
    source: "US Bureau of Labor Statistics CPI release",
    endDate: "2026-10-31",
    riskLevel: "Medium",
  },
  {
    id: "us-unemployment-above-45-2026-12",
    title: "Will US unemployment be above 4.5% for December 2026?",
    category: "Macro",
    settlementRule:
      "YES if the official US unemployment rate for December 2026 is greater than 4.5% in the initial BLS release. Otherwise NO.",
    source: "US Bureau of Labor Statistics jobs report",
    endDate: "2027-01-31",
    riskLevel: "Medium",
  },

  // RWA
  {
    id: "tokenized-treasury-tvl-above-10b-2026",
    title: "Will tokenized Treasury TVL exceed $10B before 2027?",
    category: "RWA",
    settlementRule:
      "YES if a reputable public RWA dashboard reports tokenized US Treasury TVL above 10 billion USD before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Selected RWA TVL dashboard",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
  {
    id: "rwa-protocol-launch-on-arc-2026",
    title: "Will an RWA protocol launch on Arc Testnet before 2027?",
    category: "RWA",
    settlementRule:
      "YES if a project publicly launches an RWA product, demo, or protocol deployment on Arc Testnet before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Official project announcement and Arc explorer evidence",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
  {
    id: "tokenized-gold-tvl-above-2b-2026",
    title: "Will tokenized gold market cap exceed $2B before 2027?",
    category: "RWA",
    settlementRule:
      "YES if selected public market cap sources show tokenized gold assets exceeding 2 billion USD before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Selected tokenized gold market cap dashboard",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },

  // Arc
  {
    id: "arc-mainnet-announced-2026",
    title: "Will Arc mainnet be officially announced before 2027?",
    category: "Arc",
    settlementRule:
      "YES if Circle or the official Arc channel announces Arc mainnet launch or mainnet availability before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Official Circle / Arc announcement",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
  {
    id: "arc-builder-demo-day-2026",
    title: "Will 25+ builder demos launch on Arc Testnet before 2027?",
    category: "Arc",
    settlementRule:
      "YES if at least 25 distinct public demos with Arc Testnet transaction or deployment evidence are publicly shared before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Public demo links plus Arc explorer evidence",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
  {
    id: "ARCM-deploy-50-markets-2026",
    title: "Will ARCM deploy 50 tradable markets before 2027?",
    category: "Arc",
    settlementRule:
      "YES if ARCM has at least 50 unique tradable market contracts with AMM addresses deployed on Arc Testnet before Jan 1, 2027 UTC. Otherwise NO.",
    source: "ARCM deployment records and Arc explorer",
    endDate: "2027-01-01",
    riskLevel: "Low",
  },

  // Privacy
  {
    id: "zk-app-launch-on-arc-2026",
    title: "Will a ZK privacy demo launch on Arc Testnet before 2027?",
    category: "Privacy",
    settlementRule:
      "YES if a public ZK or privacy-preserving demo with Arc Testnet transaction evidence is launched before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Official project demo and Arc explorer evidence",
    endDate: "2027-01-01",
    riskLevel: "High",
  },
  {
    id: "privacy-market-feature-preview-2026",
    title: "Will ARCM ship a private positions preview before 2027?",
    category: "Privacy",
    settlementRule:
      "YES if ARCM publicly ships a private positions or shielded positions preview page before Jan 1, 2027 UTC. Otherwise NO.",
    source: "ARCM public app and announcement",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
  {
    id: "zk-proof-verifier-on-arc-2026",
    title: "Will a ZK proof verifier contract deploy on Arc Testnet before 2027?",
    category: "Privacy",
    settlementRule:
      "YES if a public ZK proof verifier contract is deployed and verified or documented on Arc Testnet before Jan 1, 2027 UTC. Otherwise NO.",
    source: "Arc explorer contract evidence and project docs",
    endDate: "2027-01-01",
    riskLevel: "Medium",
  },
];

