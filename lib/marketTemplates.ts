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
  // New multi-category templates
  {
    id: "btc-above-65000-2026-07-31",
    title: "Will BTC close above $65,000 on July 31, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if BTC/USD daily candle close is strictly above 65000 on Coinbase for July 31, 2026 UTC. Otherwise NO.",
    source: "Coinbase BTC/USD daily close",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "eth-above-1800-2026-07-31",
    title: "Will ETH close above $1,800 on July 31, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if ETH/USD daily candle close is strictly above 1800 on Coinbase for July 31, 2026 UTC. Otherwise NO.",
    source: "Coinbase ETH/USD daily close",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "sol-above-80-2026-07-31",
    title: "Will SOL close above $80 on July 31, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if SOL/USD daily candle close is strictly above 80 on Coinbase for July 31, 2026 UTC. Otherwise NO.",
    source: "Coinbase SOL/USD daily close",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "coin-above-160-2026-07-31",
    title: "Will Coinbase COIN close above $160 on July 31, 2026?",
    category: "Crypto",
    settlementRule:
      "YES if COIN official closing price is strictly above 160 USD on July 31, 2026. Otherwise NO.",
    source: "Nasdaq official COIN closing price",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "stablecoin-supply-above-250b-before-2026-09-01",
    title: "Will total stablecoin supply exceed $250B before September 1, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if DefiLlama shows total stablecoin market cap equal to or above 250B USD on any day before September 1, 2026. Otherwise NO.",
    source: "DefiLlama Stablecoins",
    endDate: "2026-09-01",
    riskLevel: "Medium",
  },
  {
    id: "usdc-market-cap-above-60b-before-2026-09-01",
    title: "Will USDC market cap exceed $60B before September 1, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if DefiLlama shows USDC market cap equal to or above 60B USD on any day before September 1, 2026. Otherwise NO.",
    source: "DefiLlama Stablecoins / USDC",
    endDate: "2026-09-01",
    riskLevel: "Medium",
  },
  {
    id: "usdt-below-099-before-2026-08-01",
    title: "Will USDT trade below $0.99 before August 1, 2026?",
    category: "Stablecoins",
    settlementRule:
      "YES if USDT/USD trades below 0.99 on the selected source at any time before August 1, 2026 00:00 UTC. Otherwise NO.",
    source: "Coinbase or Binance USDT/USD spot market",
    endDate: "2026-08-01",
    riskLevel: "Medium",
  },
  {
    id: "nvda-above-210-2026-07-31",
    title: "Will NVDA close above $210 on July 31, 2026?",
    category: "AI",
    settlementRule:
      "YES if NVDA official closing price is strictly above 210 USD on July 31, 2026. Otherwise NO.",
    source: "Nasdaq official NVDA closing price",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "microsoft-mentions-ai-agents-next-earnings-call",
    title: "Will Microsoft mention \"AI agents\" in its next earnings call?",
    category: "AI",
    settlementRule:
      "YES if Microsoft's next earnings call transcript includes the phrase \"AI agents\" or \"agentic AI\". Otherwise NO.",
    source: "Microsoft official earnings transcript",
    endDate: "2026-09-01",
    riskLevel: "Medium",
  },
  {
    id: "google-public-ai-agent-product-before-2026-09-01",
    title: "Will Google release a public AI agent product before September 1, 2026?",
    category: "AI",
    settlementRule:
      "YES if Google publicly releases an AI agent product available to external users before September 1, 2026. Otherwise NO.",
    source: "Official Google blog, Google AI blog, or Google product announcement",
    endDate: "2026-09-01",
    riskLevel: "High",
  },
  {
    id: "fed-cut-rates-before-2026-09-30",
    title: "Will the Fed cut rates before September 30, 2026?",
    category: "Macro",
    settlementRule:
      "YES if the Federal Reserve lowers the federal funds target range at any scheduled or emergency meeting before September 30, 2026. Otherwise NO.",
    source: "Federal Reserve FOMC target range announcement",
    endDate: "2026-09-30",
    riskLevel: "Medium",
  },
  {
    id: "us-cpi-yoy-below-3-july-2026",
    title: "Will US CPI YoY be below 3.0% for July 2026?",
    category: "Macro",
    settlementRule:
      "YES if headline CPI year-over-year for July 2026 is below 3.0%. Otherwise NO.",
    source: "U.S. Bureau of Labor Statistics CPI release",
    endDate: "2026-08-31",
    riskLevel: "Medium",
  },
  {
    id: "gold-above-2750-2026-07-31",
    title: "Will gold close above $2,750 on July 31, 2026?",
    category: "Macro",
    settlementRule:
      "YES if gold official close/settlement is strictly above 2750 USD on July 31, 2026. Otherwise NO.",
    source: "COMEX gold futures official settlement or selected gold spot reference",
    endDate: "2026-07-31",
    riskLevel: "Medium",
  },
  {
    id: "tokenized-us-treasury-aum-above-8b-before-2026-09-01",
    title: "Will tokenized US Treasury AUM exceed $8B before September 1, 2026?",
    category: "RWA",
    settlementRule:
      "YES if tokenized US Treasury AUM is equal to or above 8B USD on the selected source before September 1, 2026. Otherwise NO.",
    source: "RWA.xyz or DefiLlama RWA dashboard",
    endDate: "2026-09-01",
    riskLevel: "Medium",
  },
  {
    id: "blackrock-buidl-aum-above-2b-before-2026-09-01",
    title: "Will BlackRock BUIDL AUM exceed $2B before September 1, 2026?",
    category: "RWA",
    settlementRule:
      "YES if BlackRock BUIDL AUM is equal to or above 2B USD before September 1, 2026. Otherwise NO.",
    source: "Securitize / BlackRock BUIDL official or RWA.xyz",
    endDate: "2026-09-01",
    riskLevel: "Medium",
  },
  {
    id: "major-bank-tokenized-deposit-pilot-before-2026-09-30",
    title: "Will a major bank announce a tokenized deposit pilot before September 30, 2026?",
    category: "RWA",
    settlementRule:
      "YES if a major bank officially announces a tokenized deposit pilot before September 30, 2026. Otherwise NO.",
    source: "Official announcement from JPMorgan, Citi, HSBC, Standard Chartered, BNY, or another top-tier global bank",
    endDate: "2026-09-30",
    riskLevel: "Medium",
  },
  {
    id: "ethereum-l2-private-transfers-before-2026-09-30",
    title: "Will an Ethereum L2 announce private transfers before September 30, 2026?",
    category: "Privacy",
    settlementRule:
      "YES if an Ethereum L2 officially announces private or shielded transfers on mainnet or public testnet before September 30, 2026. Otherwise NO.",
    source: "Official announcement from the L2 team",
    endDate: "2026-09-30",
    riskLevel: "High",
  },
  {
    id: "major-wallet-privacy-transfers-before-2026-09-30",
    title: "Will a major wallet add privacy-preserving transfer support before September 30, 2026?",
    category: "Privacy",
    settlementRule:
      "YES if a major crypto wallet publicly releases privacy-preserving transfer support before September 30, 2026. Otherwise NO.",
    source: "Official wallet release notes or announcement",
    endDate: "2026-09-30",
    riskLevel: "High",
  },
  {
    id: "arc-testnet-above-1m-transactions-before-2026-08-31",
    title: "Will Arc Network Testnet process over 1M transactions before August 31, 2026?",
    category: "Arc",
    settlementRule:
      "YES if ArcScan Testnet shows total transactions above 1,000,000 before August 31, 2026. Otherwise NO.",
    source: "ArcScan Testnet explorer",
    endDate: "2026-08-31",
    riskLevel: "Medium",
  },
  {
    id: "arc-testnet-10-public-apps-before-2026-09-30",
    title: "Will 10+ public apps deploy on Arc Network Testnet before September 30, 2026?",
    category: "Arc",
    settlementRule:
      "YES if at least 10 distinct public apps are verifiably deployed or publicly demoed on Arc Network Testnet before September 30, 2026. Otherwise NO.",
    source: "Arc ecosystem announcements, public app pages, or official Arc ecosystem listing",
    endDate: "2026-09-30",
    riskLevel: "Medium",
  },
];

