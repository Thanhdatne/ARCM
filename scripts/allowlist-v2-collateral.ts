import { ethers } from "hardhat";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function requireAddress(name: string, value: string | undefined) {
  const address = value?.trim();

  if (!address || !ethers.isAddress(address)) {
    throw new Error(`${name} must be a valid address.`);
  }

  if (address === ethers.ZeroAddress) {
    throw new Error(`${name} cannot be zero address.`);
  }

  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error(`${name} has no contract code on this network.`);
  }

  return address;
}

async function main() {
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error("No operator signer found. Configure PRIVATE_KEY.");
  }

  const allowlistAddress = await requireAddress(
    "NEXT_PUBLIC_COLLATERAL_ALLOWLIST_ADDRESS",
    process.env.NEXT_PUBLIC_COLLATERAL_ALLOWLIST_ADDRESS,
  );

  const collateralAddress = await requireAddress(
    "V2_COLLATERAL_ADDRESS",
    process.env.V2_COLLATERAL_ADDRESS,
  );

  const shouldExecute = process.env.ALLOWLIST_EXECUTE === "true";
  const allowed = process.env.ALLOWLIST_ALLOWED !== "false";

  const allowlist = await ethers.getContractAt(
    "CollateralAllowlist",
    allowlistAddress,
    operator,
  );

  const collateral = new ethers.Contract(
    collateralAddress,
    ERC20_ABI,
    ethers.provider,
  );

  const symbol = await collateral.symbol();
  const decimals = await collateral.decimals();
  const before = await allowlist.isCollateralAllowed(collateralAddress);

  console.log("=== ARCM V2 collateral allowlist ===");
  console.log(`Operator: ${operator.address}`);
  console.log(`Allowlist: ${allowlistAddress}`);
  console.log(`Collateral: ${collateralAddress}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Current allowed: ${before}`);
  console.log(`Requested allowed: ${allowed}`);

  if (!shouldExecute) {
    console.log("\nDry run only. Set ALLOWLIST_EXECUTE=true to send the transaction.");
    return;
  }

  if (before === allowed) {
    console.log("\nNo transaction needed. State already matches request.");
    return;
  }

  const tx = await allowlist.setCollateralAllowed(collateralAddress, allowed);
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block: ${receipt?.blockNumber}`);

  const after = await allowlist.isCollateralAllowed(collateralAddress);
  console.log(`Final allowed: ${after}`);

  if (after !== allowed) {
    throw new Error("Allowlist state did not update as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
