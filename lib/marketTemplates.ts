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
  homeTeam?: string;
  awayTeam?: string;
  stage?: string;
  kickoffTime?: string;
  homeCountryCode?: string;
  awayCountryCode?: string;
};

export const MARKET_TEMPLATES: MarketTemplate[] = [
  // World Cup Round of 32 knockout templates
  {
    id: "world-cup-r32-brazil-eliminate-japan-2026-06-30",
    title: "Will Brazil eliminate Japan in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Brazil advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Japan advances.",
    source: "Official FIFA match result",
    endDate: "2026-06-30",
    riskLevel: "Low",
    homeTeam: "Brazil",
    awayTeam: "Japan",
    stage: "Round of 32",
    kickoffTime: "2026-06-29T17:00:00Z",
    homeCountryCode: "br",
    awayCountryCode: "jp",
  },
  {
    id: "world-cup-r32-germany-eliminate-paraguay-2026-06-30",
    title: "Will Germany eliminate Paraguay in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Germany advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Paraguay advances.",
    source: "Official FIFA match result",
    endDate: "2026-06-30",
    riskLevel: "Low",
    homeTeam: "Germany",
    awayTeam: "Paraguay",
    stage: "Round of 32",
    kickoffTime: "2026-06-29T20:30:00Z",
    homeCountryCode: "de",
    awayCountryCode: "py",
  },
  {
    id: "world-cup-r32-netherlands-eliminate-morocco-2026-06-30",
    title: "Will Netherlands eliminate Morocco in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Netherlands advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Morocco advances.",
    source: "Official FIFA match result",
    endDate: "2026-06-30",
    riskLevel: "Low",
    homeTeam: "Netherlands",
    awayTeam: "Morocco",
    stage: "Round of 32",
    kickoffTime: "2026-06-30T01:00:00Z",
    homeCountryCode: "nl",
    awayCountryCode: "ma",
  },
  {
    id: "world-cup-r32-ivory-coast-eliminate-norway-2026-07-01",
    title: "Will Ivory Coast eliminate Norway in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Ivory Coast advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Norway advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-01",
    riskLevel: "Low",
    homeTeam: "Ivory Coast",
    awayTeam: "Norway",
    stage: "Round of 32",
    kickoffTime: "2026-06-30T17:00:00Z",
    homeCountryCode: "ci",
    awayCountryCode: "no",
  },
  {
    id: "world-cup-r32-france-eliminate-sweden-2026-07-01",
    title: "Will France eliminate Sweden in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if France advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Sweden advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-01",
    riskLevel: "Low",
    homeTeam: "France",
    awayTeam: "Sweden",
    stage: "Round of 32",
    kickoffTime: "2026-06-30T21:00:00Z",
    homeCountryCode: "fr",
    awayCountryCode: "se",
  },
  {
    id: "world-cup-r32-mexico-eliminate-ecuador-2026-07-01",
    title: "Will Mexico eliminate Ecuador in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Mexico advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Ecuador advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-01",
    riskLevel: "Low",
    homeTeam: "Mexico",
    awayTeam: "Ecuador",
    stage: "Round of 32",
    kickoffTime: "2026-07-01T01:00:00Z",
    homeCountryCode: "mx",
    awayCountryCode: "ec",
  },
  {
    id: "world-cup-r32-england-eliminate-dr-congo-2026-07-01",
    title: "Will England eliminate DR Congo in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if England advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if DR Congo advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-01",
    riskLevel: "Low",
    homeTeam: "England",
    awayTeam: "DR Congo",
    stage: "Round of 32",
    kickoffTime: "2026-07-01T16:00:00Z",
    homeCountryCode: "gb-eng",
    awayCountryCode: "cd",
  },
  {
    id: "world-cup-r32-belgium-eliminate-senegal-2026-07-02",
    title: "Will Belgium eliminate Senegal in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Belgium advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Senegal advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-02",
    riskLevel: "Low",
    homeTeam: "Belgium",
    awayTeam: "Senegal",
    stage: "Round of 32",
    kickoffTime: "2026-07-01T20:00:00Z",
    homeCountryCode: "be",
    awayCountryCode: "sn",
  },
  {
    id: "world-cup-r32-united-states-eliminate-bosnia-and-herzegovina-2026-07-02",
    title: "Will United States eliminate Bosnia and Herzegovina in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if United States advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Bosnia and Herzegovina advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-02",
    riskLevel: "Low",
    homeTeam: "United States",
    awayTeam: "Bosnia and Herzegovina",
    stage: "Round of 32",
    kickoffTime: "2026-07-02T00:00:00Z",
    homeCountryCode: "us",
    awayCountryCode: "ba",
  },
  {
    id: "world-cup-r32-spain-eliminate-austria-2026-07-03",
    title: "Will Spain eliminate Austria in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Spain advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Austria advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-03",
    riskLevel: "Low",
    homeTeam: "Spain",
    awayTeam: "Austria",
    stage: "Round of 32",
    kickoffTime: "2026-07-02T19:00:00Z",
    homeCountryCode: "es",
    awayCountryCode: "at",
  },
  {
    id: "world-cup-r32-portugal-eliminate-croatia-2026-07-03",
    title: "Will Portugal eliminate Croatia in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Portugal advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Croatia advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-03",
    riskLevel: "Low",
    homeTeam: "Portugal",
    awayTeam: "Croatia",
    stage: "Round of 32",
    kickoffTime: "2026-07-02T23:00:00Z",
    homeCountryCode: "pt",
    awayCountryCode: "hr",
  },
  {
    id: "world-cup-r32-switzerland-eliminate-algeria-2026-07-03",
    title: "Will Switzerland eliminate Algeria in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Switzerland advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Algeria advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-03",
    riskLevel: "Low",
    homeTeam: "Switzerland",
    awayTeam: "Algeria",
    stage: "Round of 32",
    kickoffTime: "2026-07-03T03:00:00Z",
    homeCountryCode: "ch",
    awayCountryCode: "dz",
  },
  {
    id: "world-cup-r32-australia-eliminate-egypt-2026-07-04",
    title: "Will Australia eliminate Egypt in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Australia advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Egypt advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-04",
    riskLevel: "Low",
    homeTeam: "Australia",
    awayTeam: "Egypt",
    stage: "Round of 32",
    kickoffTime: "2026-07-03T18:00:00Z",
    homeCountryCode: "au",
    awayCountryCode: "eg",
  },
  {
    id: "world-cup-r32-argentina-eliminate-cape-verde-2026-07-04",
    title: "Will Argentina eliminate Cape Verde in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Argentina advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Cape Verde advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-04",
    riskLevel: "Low",
    homeTeam: "Argentina",
    awayTeam: "Cape Verde",
    stage: "Round of 32",
    kickoffTime: "2026-07-03T22:00:00Z",
    homeCountryCode: "ar",
    awayCountryCode: "cv",
  },
  {
    id: "world-cup-r32-colombia-eliminate-ghana-2026-07-04",
    title: "Will Colombia eliminate Ghana in the Round of 32?",
    category: "World Cup" as MarketTemplateCategory,
    settlementRule:
      "YES if Colombia advances to the Round of 16 from this Round of 32 match, including extra time or penalties. NO if Ghana advances.",
    source: "Official FIFA match result",
    endDate: "2026-07-04",
    riskLevel: "Low",
    homeTeam: "Colombia",
    awayTeam: "Ghana",
    stage: "Round of 32",
    kickoffTime: "2026-07-04T01:30:00Z",
    homeCountryCode: "co",
    awayCountryCode: "gh",
  },
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

