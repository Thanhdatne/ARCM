import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMarketV2Fixture } from "./helpers/marketV2Fixture";

describe("PredictionMarketAMMV2", function () {
  async function deployAmmFixture(decimals = 18, symbol = "ARCT", feeOnTransfer = false) {
    const fixture = await deployMarketV2Fixture(decimals, symbol, feeOnTransfer);
    const liquidity = decimals === 6 ? 1_000_000_000n : ethers.parseEther("1000");
    const amm = await (await ethers.getContractFactory("PredictionMarketAMMV2")).deploy(
      await fixture.market.getAddress(), 200, fixture.owner.address
    );
    return { ...fixture, amm, liquidity };
  }

  async function initialize(decimals = 18, symbol = "ARCT") {
    const fixture = await deployAmmFixture(decimals, symbol);
    await fixture.collateral.mint(fixture.owner.address, fixture.liquidity);
    await fixture.collateral.approve(await fixture.amm.getAddress(), fixture.liquidity);
    await fixture.amm.initialize(fixture.owner.address, fixture.liquidity);
    return fixture;
  }

  async function deadline() {
    return BigInt(await time.latest()) + 100n;
  }

  async function expectReservesMatchBalances(amm: any, longToken: any, shortToken: any) {
    const [yesReserve, noReserve] = await amm.getReserves();
    expect(await longToken.balanceOf(await amm.getAddress())).to.equal(yesReserve);
    expect(await shortToken.balanceOf(await amm.getAddress())).to.equal(noReserve);
  }

  for (const [symbol, decimals] of [["ARCT", 18], ["USDC", 6]] as const) {
    it(`initializes an authorized ${decimals}-decimal ${symbol} pool in raw units`, async function () {
      const { owner, collateral, market, longToken, shortToken, amm, liquidity } =
        await deployAmmFixture(decimals, symbol);
      await collateral.mint(owner.address, liquidity);
      await collateral.approve(await amm.getAddress(), liquidity);

      await expect(amm.initialize(owner.address, liquidity))
        .to.emit(amm, "Initialized").withArgs(owner.address, owner.address, liquidity);

      expect(await amm.collateralDecimals()).to.equal(decimals);
      expect(await amm.outcomeDecimals()).to.equal(decimals);
      expect(await amm.collateralToken()).to.equal(await collateral.getAddress());
      expect(await amm.longToken()).to.equal(await market.longToken());
      expect(await amm.shortToken()).to.equal(await market.shortToken());
      expect(await amm.getReserves()).to.deep.equal([liquidity, liquidity]);
      await expectReservesMatchBalances(amm, longToken, shortToken);
    });
  }

  it("rejects arbitrary and repeated initialization", async function () {
    const { owner, other, collateral, amm, liquidity } = await deployAmmFixture();
    await collateral.mint(owner.address, liquidity * 2n);
    await collateral.approve(await amm.getAddress(), liquidity * 2n);
    await expect(amm.connect(other).initialize(owner.address, liquidity)).to.be.revertedWith("Not initializer");
    await amm.initialize(owner.address, liquidity);
    await expect(amm.initialize(owner.address, liquidity)).to.be.revertedWith("Already initialized");
  });

  it("rejects invalid and incompatible market configuration", async function () {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PredictionMarketAMMV2");
    await expect(factory.deploy(ethers.ZeroAddress, 200, owner.address)).to.be.revertedWith("Invalid market");
    await expect(factory.deploy(owner.address, 200, owner.address)).to.be.revertedWith("Invalid market");

    const { collateral, finder, market } = await deployMarketV2Fixture();
    const v1 = await (await ethers.getContractFactory("EventBasedPredictionMarket")).deploy(
      "V1", await collateral.getAddress(), "0x", await finder.getAddress(), ethers.ZeroAddress, 0, 1, 0
    );
    await expect(factory.deploy(await v1.getAddress(), 200, owner.address)).to.be.reverted;
    await expect(factory.deploy(await market.getAddress(), 10_000, owner.address)).to.be.revertedWith("Fee too high");
    await expect(factory.deploy(await market.getAddress(), 200, ethers.ZeroAddress)).to.be.revertedWith("Invalid initializer");
  });

  for (const side of ["Yes", "No"] as const) {
    it(`buys ${side.toUpperCase()} at the quoted raw-unit output`, async function () {
      const { user, collateral, longToken, shortToken, amm } = await initialize();
      const amount = ethers.parseEther("10");
      const quote = await amm[`calcBuy${side}`](amount);
      await collateral.mint(user.address, amount);
      await collateral.connect(user).approve(await amm.getAddress(), amount);

      await expect(amm.connect(user)[`buy${side}`](amount, quote, await deadline()))
        .to.emit(amm, `Buy${side}`);
      const token = side === "Yes" ? longToken : shortToken;
      expect(await token.balanceOf(user.address)).to.equal(quote);
      await expectReservesMatchBalances(amm, longToken, shortToken);
    });

    it(`sells ${side.toUpperCase()} at the quoted raw-unit output`, async function () {
      const { user, collateral, market, longToken, shortToken, amm } = await initialize();
      const amount = ethers.parseEther("10");
      await collateral.mint(user.address, amount);
      await collateral.connect(user).approve(await market.getAddress(), amount);
      await market.connect(user).create(amount);
      const token = side === "Yes" ? longToken : shortToken;
      await token.connect(user).approve(await amm.getAddress(), amount);
      const quote = await amm[`calcSell${side}`](amount);

      await expect(amm.connect(user)[`sell${side}`](amount, quote, await deadline()))
        .to.emit(amm, `Sell${side}`);
      expect(await collateral.balanceOf(user.address)).to.equal(quote);
      await expectReservesMatchBalances(amm, longToken, shortToken);
    });
  }

  it("keeps quote and execution rounding identical across 6-decimal micro and whole-unit trades", async function () {
    const { user, collateral, market, longToken, shortToken, amm } = await initialize(6, "USDC");
    const buyIn = 1_000_001n;
    await collateral.mint(user.address, buyIn + 10n);
    await collateral.connect(user).approve(await amm.getAddress(), buyIn);
    const buyQuote = await amm.calcBuyYes(buyIn);
    await amm.connect(user).buyYes(buyIn, buyQuote, await deadline());
    expect(await longToken.balanceOf(user.address)).to.equal(buyQuote);

    await collateral.connect(user).approve(await market.getAddress(), 10n);
    await market.connect(user).create(10n);
    await shortToken.connect(user).approve(await amm.getAddress(), 10n);
    const sellQuote = await amm.calcSellNo(10n);
    expect(sellQuote).to.be.greaterThan(0n);
    const before = await collateral.balanceOf(user.address);
    await amm.connect(user).sellNo(10n, sellQuote, await deadline());
    expect(await collateral.balanceOf(user.address) - before).to.equal(sellQuote);
    await expectReservesMatchBalances(amm, longToken, shortToken);
  });

  it("enforces minOut success and failure atomically", async function () {
    const { user, collateral, longToken, shortToken, amm } = await initialize();
    const amount = ethers.parseEther("5");
    await collateral.mint(user.address, amount * 2n);
    await collateral.connect(user).approve(await amm.getAddress(), amount * 2n);
    const quote = await amm.calcBuyYes(amount);
    await expect(amm.connect(user).buyYes(amount, quote + 1n, await deadline())).to.be.revertedWith("Slippage exceeded");
    expect(await collateral.balanceOf(user.address)).to.equal(amount * 2n);
    await expectReservesMatchBalances(amm, longToken, shortToken);
    await amm.connect(user).buyYes(amount, quote, await deadline());
    expect(await longToken.balanceOf(user.address)).to.equal(quote);
  });

  it("accepts an exact deadline and rejects an expired deadline atomically", async function () {
    const { user, collateral, longToken, shortToken, amm } = await initialize();
    const amount = ethers.parseEther("1");
    await collateral.mint(user.address, amount * 2n);
    await collateral.connect(user).approve(await amm.getAddress(), amount * 2n);
    const exact = BigInt(await time.latest()) + 1n;
    await time.setNextBlockTimestamp(exact);
    await amm.connect(user).buyNo(amount, 0, exact);
    const reserves = await amm.getReserves();
    await expect(amm.connect(user).buyNo(amount, 0, exact)).to.be.revertedWith("Deadline expired");
    expect(await amm.getReserves()).to.deep.equal(reserves);
    await expectReservesMatchBalances(amm, longToken, shortToken);
  });

  it("rejects zero trades and rounded-zero sell output", async function () {
    const { user, amm } = await initialize(6, "USDC");
    const expiry = await deadline();
    await expect(amm.connect(user).buyYes(0, 0, expiry)).to.be.revertedWith("Zero amount");
    await expect(amm.connect(user).buyNo(0, 0, expiry)).to.be.revertedWith("Zero amount");
    await expect(amm.connect(user).sellYes(0, 0, expiry)).to.be.revertedWith("Zero amount");
    await expect(amm.connect(user).sellNo(0, 0, expiry)).to.be.revertedWith("Zero amount");
    expect(await amm.calcSellYes(1n)).to.equal(0n);
    await expect(amm.connect(user).sellYes(1n, 0, expiry)).to.be.revertedWith("Zero output");
  });

  it("rejects fee-on-transfer collateral during initialization", async function () {
    const { owner, collateral, amm, liquidity } = await deployAmmFixture(18, "FEE", true);
    await collateral.mint(owner.address, liquidity);
    await collateral.approve(await amm.getAddress(), liquidity);
    await expect(amm.initialize(owner.address, liquidity)).to.be.revertedWith("Unsupported collateral transfer");
    expect(await amm.initialized()).to.equal(false);
    expect(await collateral.balanceOf(await amm.getAddress())).to.equal(0n);
  });

  it("rejects fee-on-transfer collateral buys after exact initialization", async function () {
    const { owner, user, collateral, longToken, amm, liquidity } = await deployAmmFixture(18, "FEE", true);
    await collateral.setFeesEnabled(false);
    await collateral.mint(owner.address, liquidity);
    await collateral.approve(await amm.getAddress(), liquidity);
    await amm.initialize(owner.address, liquidity);
    await collateral.setFeesEnabled(true);
    const amount = ethers.parseEther("100");
    await collateral.mint(user.address, amount);
    await collateral.connect(user).approve(await amm.getAddress(), amount);
    await expect(amm.connect(user).buyYes(amount, 0, await deadline()))
      .to.be.revertedWith("Unsupported collateral transfer");
    expect(await collateral.balanceOf(await amm.getAddress())).to.equal(0n);
    expect(await longToken.balanceOf(user.address)).to.equal(0n);
  });

  it("keeps post-trade products nondecreasing under the fee model", async function () {
    const { user, collateral, market, longToken, shortToken, amm } = await initialize(6, "USDC");
    const amount = 25_000_000n;
    await collateral.mint(user.address, amount * 2n);
    await collateral.connect(user).approve(await amm.getAddress(), amount);
    const [yes0, no0] = await amm.getReserves();
    await amm.connect(user).buyYes(amount, 0, await deadline());
    const [yes1, no1] = await amm.getReserves();
    expect(yes1 * no1).to.be.greaterThanOrEqual(yes0 * no0);

    await collateral.connect(user).approve(await market.getAddress(), amount);
    await market.connect(user).create(amount);
    await shortToken.connect(user).approve(await amm.getAddress(), amount);
    await amm.connect(user).sellNo(amount, 0, await deadline());
    const [yes2, no2] = await amm.getReserves();
    expect(yes2 * no2).to.be.greaterThanOrEqual(yes1 * no1);
    await expectReservesMatchBalances(amm, longToken, shortToken);
  });
});
