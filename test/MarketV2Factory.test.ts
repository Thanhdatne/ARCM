import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
import { impersonateAccount, setBalance, time } from "@nomicfoundation/hardhat-network-helpers";

describe("MarketV2Factory", function () {
  async function deployFactoryFixture() {
    const [owner, creator, trader, other] = await ethers.getSigners();
    const allowlist = await (await ethers.getContractFactory("CollateralAllowlist")).deploy(owner.address);
    const finder = await (await ethers.getContractFactory("MockFinder")).deploy();
    const identifierWhitelist = await (await ethers.getContractFactory("MockIdentifierWhitelist")).deploy();
    const collateralWhitelist = await (await ethers.getContractFactory("MockCollateralWhitelist")).deploy();
    const oracle = await (await ethers.getContractFactory("MockUmaV2")).deploy();

    await identifierWhitelist.addSupportedIdentifier(ethers.encodeBytes32String("YES_OR_NO_QUERY"));
    await finder.changeImplementationAddress(
      ethers.encodeBytes32String("IdentifierWhitelist"), await identifierWhitelist.getAddress()
    );
    await finder.changeImplementationAddress(
      ethers.encodeBytes32String("CollateralWhitelist"), await collateralWhitelist.getAddress()
    );
    await finder.changeImplementationAddress(
      ethers.encodeBytes32String("OptimisticOracleV2"), await oracle.getAddress()
    );

    const codeStoreFactory = await ethers.getContractFactory("CreationCodeStore");
    const marketArtifact = await artifacts.readArtifact("EventBasedPredictionMarketV2");
    const ammArtifact = await artifacts.readArtifact("PredictionMarketAMMV2");
    const marketCodeStore = await codeStoreFactory.deploy(marketArtifact.bytecode);
    const ammCodeStore = await codeStoreFactory.deploy(ammArtifact.bytecode);
    const factory = await (await ethers.getContractFactory("MarketV2Factory")).deploy(
      await allowlist.getAddress(), await finder.getAddress(), ethers.ZeroAddress,
      await marketCodeStore.getAddress(), await ammCodeStore.getAddress()
    );

    async function deployCollateral(symbol: string, decimals: number, allowed = true, feeOnTransfer = false) {
      const tokenFactory = await ethers.getContractFactory(
        feeOnTransfer ? "MockFeeOnTransferERC20" : "MockERC20Decimals"
      );
      const collateral = await tokenFactory.deploy(`${symbol} collateral`, symbol, decimals);
      await collateralWhitelist.addToWhitelist(await collateral.getAddress());
      if (allowed) await allowlist.setCollateralAllowed(await collateral.getAddress(), true);
      return collateral;
    }

    function params(collateral: any, liquidity: bigint, reward = 0n) {
      return {
        pairName: "FACTORY-TEST",
        collateralToken: collateral,
        customAncillaryData: ethers.toUtf8Bytes("Will the factory market resolve YES?"),
        proposerReward: reward,
        optimisticOracleLivenessTime: 7200,
        optimisticOracleProposerBond: 100n,
        initialLiquidity: liquidity,
        feeBps: 200,
      };
    }

    async function createPair(collateral: any, liquidity: bigint, reward = 0n) {
      const createParams = params(await collateral.getAddress(), liquidity, reward);
      const total = liquidity + reward;
      await collateral.mint(creator.address, total);
      await collateral.connect(creator).approve(await factory.getAddress(), total);
      const addresses = await factory.connect(creator).createMarket.staticCall(createParams);
      const tx = await factory.connect(creator).createMarket(createParams);
      return { createParams, marketAddress: addresses[0], ammAddress: addresses[1], tx };
    }

    return {
      owner, creator, trader, other, allowlist, finder, collateralWhitelist, oracle,
      marketCodeStore, ammCodeStore, factory, deployCollateral, params, createPair,
    };
  }

  for (const [symbol, decimals] of [["ARCT", 18], ["USDC", 6], ["EURC", 6]] as const) {
    it(`atomically deploys and records an initialized ${symbol} ${decimals}-decimal pair`, async function () {
      const { creator, factory, deployCollateral, createPair } = await deployFactoryFixture();
      const collateral = await deployCollateral(symbol, decimals);
      const liquidity = decimals === 18 ? ethers.parseEther("1000") : 1_000_000_000n;
      const { marketAddress, ammAddress } = await createPair(collateral, liquidity);
      const market = await ethers.getContractAt("EventBasedPredictionMarketV2", marketAddress);
      const amm = await ethers.getContractAt("PredictionMarketAMMV2", ammAddress);

      expect(await market.contractVersion()).to.equal(2n);
      expect(await market.collateralToken()).to.equal(await collateral.getAddress());
      expect(await market.collateralDecimals()).to.equal(decimals);
      expect(await market.outcomeDecimals()).to.equal(decimals);
      expect(await market.longToken()).to.equal(await amm.longToken());
      expect(await market.shortToken()).to.equal(await amm.shortToken());
      expect(await amm.market()).to.equal(marketAddress);
      expect(await amm.initializer()).to.equal(await factory.getAddress());
      expect(await amm.initialized()).to.equal(true);
      expect(await amm.getReserves()).to.deep.equal([liquidity, liquidity]);
      expect(await factory.pairCount()).to.equal(1n);
      expect(await factory.getAmmForMarket(marketAddress)).to.equal(ammAddress);
      expect(await factory.getMarketForAmm(ammAddress)).to.equal(marketAddress);
      expect(await factory.getPair(0)).to.deep.equal([
        marketAddress, ammAddress, creator.address, await collateral.getAddress()
      ]);
      expect(await collateral.balanceOf(await factory.getAddress())).to.equal(0n);
    });
  }

  it("emits a complete MarketCreated event", async function () {
    const { creator, factory, deployCollateral, createPair } = await deployFactoryFixture();
    const collateral = await deployCollateral("ARCT", 18);
    const liquidity = ethers.parseEther("1000");
    const { marketAddress, ammAddress, tx } = await createPair(collateral, liquidity);

    await expect(tx).to.emit(factory, "MarketCreated").withArgs(
      0n, creator.address, marketAddress, ammAddress, await collateral.getAddress(),
      18, liquidity, 200
    );
  });

  it("pulls liquidity and proposer reward exactly and leaves no factory residue", async function () {
    const { creator, factory, oracle, deployCollateral, createPair } = await deployFactoryFixture();
    const collateral = await deployCollateral("ARCT", 18);
    const liquidity = ethers.parseEther("1000");
    const reward = ethers.parseEther("2");
    const { marketAddress } = await createPair(collateral, liquidity, reward);

    expect(await collateral.balanceOf(creator.address)).to.equal(0n);
    expect(await collateral.balanceOf(await factory.getAddress())).to.equal(0n);
    expect(await collateral.balanceOf(await oracle.getAddress())).to.equal(reward);
    expect(await collateral.balanceOf(marketAddress)).to.equal(liquidity);
  });

  it("rejects collateral absent from the ARCM allowlist before taking funds", async function () {
    const { creator, factory, deployCollateral, params } = await deployFactoryFixture();
    const collateral = await deployCollateral("NOPE", 6, false);
    const liquidity = 1_000_000n;
    await collateral.mint(creator.address, liquidity);
    await collateral.connect(creator).approve(await factory.getAddress(), liquidity);

    await expect(factory.connect(creator).createMarket(params(await collateral.getAddress(), liquidity)))
      .to.be.revertedWith("Collateral not allowed");
    expect(await collateral.balanceOf(creator.address)).to.equal(liquidity);
    expect(await factory.pairCount()).to.equal(0n);
  });

  it("rejects fee-on-transfer collateral atomically", async function () {
    const { creator, factory, deployCollateral, params } = await deployFactoryFixture();
    const collateral = await deployCollateral("FEE", 18, true, true);
    const liquidity = ethers.parseEther("1000");
    await collateral.mint(creator.address, liquidity);
    await collateral.connect(creator).approve(await factory.getAddress(), liquidity);

    await expect(factory.connect(creator).createMarket(params(await collateral.getAddress(), liquidity)))
      .to.be.revertedWith("Unsupported collateral transfer");
    expect(await factory.pairCount()).to.equal(0n);
    expect(await collateral.balanceOf(await factory.getAddress())).to.equal(0n);
  });

  it("prevents unauthorized and repeated initialization of a factory-created AMM", async function () {
    const { creator, other, factory, deployCollateral, createPair } = await deployFactoryFixture();
    const collateral = await deployCollateral("ARCT", 18);
    const liquidity = ethers.parseEther("1000");
    const { ammAddress } = await createPair(collateral, liquidity);
    const amm = await ethers.getContractAt("PredictionMarketAMMV2", ammAddress);

    await expect(amm.connect(other).initialize(creator.address, liquidity)).to.be.revertedWith("Not initializer");
    const factoryAddress = await factory.getAddress();
    await impersonateAccount(factoryAddress);
    await setBalance(factoryAddress, ethers.parseEther("1"));
    const factorySigner = await ethers.getSigner(factoryAddress);
    await expect(amm.connect(factorySigner).initialize(creator.address, liquidity)).to.be.revertedWith("Already initialized");
  });

  it("creates an AMM that can buy and sell immediately after factory deployment", async function () {
    const { trader, deployCollateral, createPair } = await deployFactoryFixture();
    const collateral = await deployCollateral("USDC", 6);
    const liquidity = 1_000_000_000n;
    const { ammAddress } = await createPair(collateral, liquidity);
    const amm = await ethers.getContractAt("PredictionMarketAMMV2", ammAddress);
    const longToken = await ethers.getContractAt("ExpandedERC20", await amm.longToken());
    const buyIn = 10_000_000n;
    await collateral.mint(trader.address, buyIn);
    await collateral.connect(trader).approve(ammAddress, buyIn);
    const buyQuote = await amm.calcBuyYes(buyIn);
    await amm.connect(trader).buyYes(buyIn, buyQuote, BigInt(await time.latest()) + 100n);
    expect(await longToken.balanceOf(trader.address)).to.equal(buyQuote);

    const sellIn = buyQuote / 2n;
    await longToken.connect(trader).approve(ammAddress, sellIn);
    const sellQuote = await amm.calcSellYes(sellIn);
    await amm.connect(trader).sellYes(sellIn, sellQuote, BigInt(await time.latest()) + 100n);
    expect(await collateral.balanceOf(trader.address)).to.equal(sellQuote);
  });
});
