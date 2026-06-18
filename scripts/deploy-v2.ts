import { artifacts, ethers } from "hardhat";

async function requireConfiguredContract(name: string, value: string | undefined) {
  const address = value?.trim();
  if (!address || !ethers.isAddress(address)) {
    throw new Error(`${name} must be configured with a valid address.`);
  }

  if ((await ethers.provider.getCode(address)) === "0x") {
    throw new Error(`${name} does not contain contract code on this network.`);
  }

  return address;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account found. Configure PRIVATE_KEY before running this script.");
  }

  const finderAddress = await requireConfiguredContract(
    "NEXT_PUBLIC_FINDER_ADDRESS",
    process.env.NEXT_PUBLIC_FINDER_ADDRESS,
  );
  const timerAddress = process.env.NEXT_PUBLIC_TIMER_ADDRESS?.trim();
  const configuredTimer = timerAddress && ethers.isAddress(timerAddress)
    ? timerAddress
    : ethers.ZeroAddress;

  if (
    configuredTimer !== ethers.ZeroAddress &&
    (await ethers.provider.getCode(configuredTimer)) === "0x"
  ) {
    throw new Error("NEXT_PUBLIC_TIMER_ADDRESS does not contain contract code on this network.");
  }

  console.log("=== ARCM V2 foundation deployment ===");
  console.log(`Deployer: ${deployer.address}`);

  const allowlist = await (
    await ethers.getContractFactory("CollateralAllowlist", deployer)
  ).deploy(deployer.address);
  await allowlist.waitForDeployment();

  const codeStoreFactory = await ethers.getContractFactory("CreationCodeStore", deployer);
  const marketArtifact = await artifacts.readArtifact("EventBasedPredictionMarketV2");
  const ammArtifact = await artifacts.readArtifact("PredictionMarketAMMV2");

  const marketCodeStore = await codeStoreFactory.deploy(marketArtifact.bytecode);
  await marketCodeStore.waitForDeployment();
  const ammCodeStore = await codeStoreFactory.deploy(ammArtifact.bytecode);
  await ammCodeStore.waitForDeployment();

  const factory = await (
    await ethers.getContractFactory("MarketV2Factory", deployer)
  ).deploy(
    await allowlist.getAddress(),
    finderAddress,
    configuredTimer,
    await marketCodeStore.getAddress(),
    await ammCodeStore.getAddress(),
  );
  await factory.waitForDeployment();

  console.log("\nDeployment complete. No collateral was enabled and no env file was written.");
  console.log("\nAdd these lines only after verifying the deployment:");
  console.log(`NEXT_PUBLIC_COLLATERAL_ALLOWLIST_ADDRESS=${await allowlist.getAddress()}`);
  console.log(`NEXT_PUBLIC_MARKET_V2_FACTORY_ADDRESS=${await factory.getAddress()}`);
  console.log("NEXT_PUBLIC_ENABLE_MARKET_V2_CREATE=false");
  console.log("NEXT_PUBLIC_PUBLIC_MARKET_VERSION=2");
  console.log("NEXT_PUBLIC_HIDE_LEGACY_V1=true");
  console.log("\nSupporting immutable code stores:");
  console.log(`Market V2 creation code: ${await marketCodeStore.getAddress()}`);
  console.log(`AMM V2 creation code: ${await ammCodeStore.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
