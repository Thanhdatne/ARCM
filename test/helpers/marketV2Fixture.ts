import { ethers } from "hardhat";

export async function deployMarketV2Fixture(decimals = 18, symbol = "ARCT", feeOnTransfer = false, reward = 0n) {
  const [owner, user, other] = await ethers.getSigners();
  const tokenFactory = await ethers.getContractFactory(feeOnTransfer ? "MockFeeOnTransferERC20" : "MockERC20Decimals");
  const collateral = await tokenFactory.deploy(`${symbol} collateral`, symbol, decimals);
  const allowlist = await (await ethers.getContractFactory("CollateralAllowlist")).deploy(owner.address);
  const finder = await (await ethers.getContractFactory("MockFinder")).deploy();
  const identifierWhitelist = await (await ethers.getContractFactory("MockIdentifierWhitelist")).deploy();
  const collateralWhitelist = await (await ethers.getContractFactory("MockCollateralWhitelist")).deploy();
  const oracle = await (await ethers.getContractFactory("MockUmaV2")).deploy();

  const identifier = ethers.encodeBytes32String("YES_OR_NO_QUERY");
  await identifierWhitelist.addSupportedIdentifier(identifier);
  await collateralWhitelist.addToWhitelist(await collateral.getAddress());
  await allowlist.setCollateralAllowed(await collateral.getAddress(), true);
  await finder.changeImplementationAddress(ethers.encodeBytes32String("IdentifierWhitelist"), await identifierWhitelist.getAddress());
  await finder.changeImplementationAddress(ethers.encodeBytes32String("CollateralWhitelist"), await collateralWhitelist.getAddress());
  await finder.changeImplementationAddress(ethers.encodeBytes32String("OptimisticOracleV2"), await oracle.getAddress());

  const deployMarket = async (token = collateral) => {
    const market = await (await ethers.getContractFactory("EventBasedPredictionMarketV2")).deploy(
      "TEST", await token.getAddress(), ethers.toUtf8Bytes("Will it happen?"), await finder.getAddress(),
      ethers.ZeroAddress, reward, 7200, 100n, await allowlist.getAddress()
    );
    if (reward > 0n) {
      await collateral.mint(owner.address, reward);
      await collateral.approve(await market.getAddress(), reward);
    }
    await market.initializeMarket();
    return market;
  };

  const market = await deployMarket();
  const longToken = await ethers.getContractAt("ExpandedERC20", await market.longToken());
  const shortToken = await ethers.getContractAt("ExpandedERC20", await market.shortToken());
  return { owner, user, other, collateral, allowlist, finder, identifierWhitelist, collateralWhitelist, oracle, market, longToken, shortToken, deployMarket };
}
