import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMarketV2Fixture } from "./helpers/marketV2Fixture";

describe("EventBasedPredictionMarketV2", function () {
  for (const [symbol, decimals] of [["ARCT", 18], ["USDC", 6], ["EURC", 6]] as const) {
    describe(`${symbol} (${decimals} decimals)`, function () {
      it("exposes version and matching collateral/outcome decimals", async function () {
        const { market, longToken, shortToken } = await deployMarketV2Fixture(decimals, symbol);
        expect(await market.contractVersion()).to.equal(2n);
        expect(await market.collateralDecimals()).to.equal(decimals);
        expect(await market.outcomeDecimals()).to.equal(decimals);
        expect(await longToken.decimals()).to.equal(decimals);
        expect(await shortToken.decimals()).to.equal(decimals);
      });

      it("creates and redeems exact raw 1:1 pairs, including repeated operations", async function () {
        const { user, collateral, market, longToken, shortToken } = await deployMarketV2Fixture(decimals, symbol);
        const amount = decimals === 6 ? 1_000_001n : ethers.parseEther("1.000000000000000001");
        await collateral.mint(user.address, amount * 2n);
        await collateral.connect(user).approve(await market.getAddress(), amount * 2n);
        await market.connect(user).create(amount);
        await market.connect(user).create(amount);
        expect(await longToken.balanceOf(user.address)).to.equal(amount * 2n);
        expect(await shortToken.balanceOf(user.address)).to.equal(amount * 2n);
        await market.connect(user).redeem(amount);
        await market.connect(user).redeem(amount);
        expect(await collateral.balanceOf(user.address)).to.equal(amount * 2n);
        expect(await longToken.balanceOf(user.address)).to.equal(0n);
      });
    });
  }

  it("is default-deny, owner-administered, and removal only blocks new markets", async function () {
    const { owner, other, collateral, allowlist, finder, market } = await deployMarketV2Fixture();
    await expect(allowlist.connect(other).setCollateralAllowed(await collateral.getAddress(), false)).to.be.reverted;
    await expect(allowlist.setCollateralAllowed(await collateral.getAddress(), false))
      .to.emit(allowlist, "CollateralAllowed").withArgs(await collateral.getAddress(), false);
    expect(await market.collateralToken()).to.equal(await collateral.getAddress());
    await expect((await ethers.getContractFactory("EventBasedPredictionMarketV2")).deploy(
      "NEW", await collateral.getAddress(), "0x", await finder.getAddress(), ethers.ZeroAddress, 0, 1, 0, await allowlist.getAddress()
    )).to.be.revertedWith("Collateral not allowed");
    expect(await allowlist.owner()).to.equal(owner.address);
  });

  it("requires both address allowlists and cannot be bypassed by a spoofed symbol", async function () {
    const { allowlist, finder, collateralWhitelist } = await deployMarketV2Fixture(6, "EURC");
    const spoof = await (await ethers.getContractFactory("MockERC20Decimals")).deploy("Fake EURC", "EURC", 6);
    await collateralWhitelist.addToWhitelist(await spoof.getAddress());
    await expect((await ethers.getContractFactory("EventBasedPredictionMarketV2")).deploy(
      "SPOOF", await spoof.getAddress(), "0x", await finder.getAddress(), ethers.ZeroAddress, 0, 1, 0, await allowlist.getAddress()
    )).to.be.revertedWith("Collateral not allowed");
    await allowlist.setCollateralAllowed(await spoof.getAddress(), true);
    await collateralWhitelist.removeFromWhitelist(await spoof.getAddress());
    await expect((await ethers.getContractFactory("EventBasedPredictionMarketV2")).deploy(
      "SPOOF", await spoof.getAddress(), "0x", await finder.getAddress(), ethers.ZeroAddress, 0, 1, 0, await allowlist.getAddress()
    )).to.be.revertedWith("Unsupported collateral type");
  });

  it("rejects zero create and redeem", async function () {
    const { market } = await deployMarketV2Fixture();
    await expect(market.create(0)).to.be.revertedWith("Amount is zero");
    await expect(market.redeem(0)).to.be.revertedWith("Amount is zero");
  });

  it("rejects fee-on-transfer collateral atomically", async function () {
    const { user, collateral, market, longToken } = await deployMarketV2Fixture(18, "FEE", true);
    const amount = ethers.parseEther("100");
    await collateral.mint(user.address, amount);
    await collateral.connect(user).approve(await market.getAddress(), amount);
    await expect(market.connect(user).create(amount)).to.be.revertedWith("Unsupported collateral transfer");
    expect(await longToken.balanceOf(user.address)).to.equal(0n);
    expect(await collateral.balanceOf(await market.getAddress())).to.equal(0n);
  });

  it("rejects fee-on-transfer collateral on outbound redemption without burning pairs", async function () {
    const { user, collateral, market, longToken, shortToken } = await deployMarketV2Fixture(18, "FEE", true);
    const amount = ethers.parseEther("100");
    await collateral.setFeesEnabled(false);
    await collateral.mint(user.address, amount);
    await collateral.connect(user).approve(await market.getAddress(), amount);
    await market.connect(user).create(amount);
    await collateral.setFeesEnabled(true);
    await expect(market.connect(user).redeem(amount)).to.be.revertedWith("Unsupported collateral transfer");
    expect(await longToken.balanceOf(user.address)).to.equal(amount);
    expect(await shortToken.balanceOf(user.address)).to.equal(amount);
    expect(await collateral.balanceOf(await market.getAddress())).to.equal(amount);
  });

  it("rejects forged settlement callbacks", async function () {
    const { other, market } = await deployMarketV2Fixture();
    await expect(market.connect(other).priceSettled(
      ethers.encodeBytes32String("YES_OR_NO_QUERY"), await market.requestTimestamp(),
      ethers.toUtf8Bytes("Will it happen?"), 1_000_000_000_000_000_000n
    )).to.be.revertedWith("Not authorized");
  });

  for (const [label, price, yesAmount, noAmount, expected] of [
    ["NO win", 0n, 7n, 9n, 9n],
    ["split settlement", 500_000_000_000_000_000n, 7n, 9n, 7n],
    ["YES win", 1_000_000_000_000_000_000n, 7n, 9n, 7n],
  ] as const) {
    it(`uses independent-floor raw payout math for ${label}`, async function () {
      const { user, collateral, oracle, market, longToken, shortToken } = await deployMarketV2Fixture(6, "USDC");
      const backing = yesAmount > noAmount ? yesAmount : noAmount;
      await collateral.mint(user.address, backing);
      await collateral.connect(user).approve(await market.getAddress(), backing);
      await market.connect(user).create(backing);
      await oracle.resolve(await market.getAddress(), price);
      expect(await market.settlementPrice()).to.equal(price);
      await market.connect(user).settle(yesAmount, noAmount);
      expect(await collateral.balanceOf(user.address)).to.equal(expected);
      expect(await longToken.balanceOf(user.address)).to.equal(backing - yesAmount);
      expect(await shortToken.balanceOf(user.address)).to.equal(backing - noAmount);
      await expect(market.connect(user).settle(yesAmount, noAmount)).to.be.reverted;
    });
  }

  it("rejects empty settlement and supports redeem before and claim after resolution", async function () {
    const { user, collateral, oracle, market } = await deployMarketV2Fixture(6, "EURC");
    await collateral.mint(user.address, 20n);
    await collateral.connect(user).approve(await market.getAddress(), 20n);
    await market.connect(user).create(20n);
    await market.connect(user).redeem(10n);
    await oracle.resolve(await market.getAddress(), 1_000_000_000_000_000_000n);
    await expect(market.connect(user).settle(0, 0)).to.be.revertedWith("Amounts are zero");
    await market.connect(user).settle(10n, 0);
    expect(await collateral.balanceOf(user.address)).to.equal(20n);
    await expect(market.connect(user).settle(10n, 0)).to.be.reverted;
  });
});
