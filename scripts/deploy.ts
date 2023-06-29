import { ethers } from "hardhat";

async function main() {
  const lendr = await ethers.deployContract("Lendr");

  await lendr.waitForDeployment();

  console.log(`Lendr deployed to ${lendr.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
