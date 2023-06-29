import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DummyERC20, DummyERC721, Lendr } from "../typechain-types";
import { BigNumberish } from "ethers";

describe("Lendr", function () {
  async function getSigners() {
    const [loaner, loanee] = await ethers.getSigners();

    return { loaner, loanee };
  }

  async function deployLendrFixture() {
    const Lendr = await ethers.getContractFactory("Lendr");
    const lendr = await Lendr.deploy();

    return lendr;
  }

  async function deployERC20Fixture(signer: HardhatEthersSigner) {
    const DummyERC20 = await ethers.getContractFactory("DummyERC20");
    const dummyERC20 = await DummyERC20.connect(signer).deploy();

    return dummyERC20;
  }

  async function deployERC721Fixture(signer: HardhatEthersSigner) {
    const DummyERC721 = await ethers.getContractFactory("DummyERC721");
    const dummyERC721 = await DummyERC721.connect(signer).deploy();

    return dummyERC721;
  }

  async function deployContractsFixture() {
    const { loaner, loanee } = await getSigners();
    const lendr = await deployLendrFixture();

    const dummyERC20 = await deployERC20Fixture(loaner);
    const dummyERC721 = await deployERC721Fixture(loanee);

    return {
      lendr,
      dummyERC20,
      dummyERC721,
      loaner,
      loanee,
    };
  }

  async function approveERC20Tokens(
    erc20: DummyERC20,
    spender: string,
    signer: HardhatEthersSigner
  ) {
    const res = await erc20.connect(signer).approve(spender, 100000);

    return res.wait();
  }

  async function approveERC721Tokens(
    erc721: DummyERC721,
    spender: string,
    signer: HardhatEthersSigner
  ) {
    const res = await erc721.connect(signer).setApprovalForAll(spender, true);

    return res.wait();
  }

  async function createLoan(
    lendr: Lendr,
    request: Lendr.CreateLendOfferRequestStruct,
    signer: HardhatEthersSigner
  ) {
    const res = await lendr.connect(signer).createOffer({
      loanee: request.loanee,
      collateralAddress: request.collateralAddress,
      collateralId: request.collateralId,
      tokenAddress: request.tokenAddress,
      numTokens: request.numTokens,
      lendDuration: request.lendDuration,
    });

    return res.wait();
  }

  async function approveTokensAndCreateLoan(
    lendr: Lendr,
    erc20: DummyERC20,
    request: Lendr.CreateLendOfferRequestStruct,
    signer: HardhatEthersSigner
  ) {
    await approveERC20Tokens(erc20, await lendr.getAddress(), signer);

    await createLoan(lendr, request, signer);
  }

  async function approveNFTsAndAcceptLoan(
    lendr: Lendr,
    erc721: DummyERC721,
    offerId: BigNumberish,
    signer: HardhatEthersSigner
  ) {
    await approveERC721Tokens(erc721, await lendr.getAddress(), signer);

    await acceptLoan(lendr, offerId, signer);
  }

  async function acceptLoan(
    lendr: Lendr,
    offerId: BigNumberish,
    signer: HardhatEthersSigner
  ) {
    const res = await lendr.connect(signer).acceptOffer(offerId);

    return res.wait();
  }

  async function cancelLoanOffer(
    lendr: Lendr,
    offerId: BigNumberish,
    signer: HardhatEthersSigner
  ) {
    const res = await lendr.connect(signer).cancelOffer(offerId);

    return res.wait();
  }

  async function claimCollateral(
    lendr: Lendr,
    offerId: BigNumberish,
    signer: HardhatEthersSigner
  ) {
    const res = await lendr.connect(signer).claimCollateral(offerId);

    return res.wait();
  }

  describe("Create Loans", function () {
    it("should create the loan", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      const initialBalance = await dummyERC20.balanceOf(loaner.address);
      const numTokens = 1000;

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens,
          lendDuration: 1000,
        },
        loaner
      );

      const offer = await lendr.lendOffers(1);
      expect(offer.creator).to.equal(loaner.address);
      expect(offer.loanee).to.equal(loanee.address);

      // Ensure funds have been deducted
      expect(await dummyERC20.balanceOf(loaner.address)).to.equal(
        initialBalance - BigInt(numTokens)
      );
    });

    it("should revert because of invalid spend allowance", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await expect(
        createLoan(
          lendr,
          {
            loanee: loanee.address,
            collateralAddress: await dummyERC721.getAddress(),
            collateralId: 1,
            tokenAddress: await dummyERC20.getAddress(),
            numTokens: 1000,
            lendDuration: 1000,
          },
          loaner
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Accept Loans", function () {
    it("should accept the loan", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await approveNFTsAndAcceptLoan(lendr, dummyERC721, 1, loanee);

      // Ensure contract now holds collateral
      expect(await dummyERC721.ownerOf(1)).to.be.equal(
        await lendr.getAddress()
      );
    });

    it("should revert because tokens have not been approved", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await expect(acceptLoan(lendr, 1, loanee)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved"
      );
    });

    it("should revert because only loanee can accept", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      const randomSigner = await ethers.getSigners();

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await expect(acceptLoan(lendr, 1, randomSigner[4])).to.be.revertedWith(
        "Only the loanee can accept the offer"
      );
    });
  });

  describe("Claim Loan Collateral", function () {
    it("should claim loan collateral successfully", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await approveNFTsAndAcceptLoan(lendr, dummyERC721, 1, loanee);

      time.setNextBlockTimestamp(new Date(Date.now() + 50000000));

      await claimCollateral(lendr, 1, loaner);

      expect(await dummyERC721.ownerOf(1)).to.be.equal(loaner.address);
    });

    it("should fail because lend period has not ended", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await approveNFTsAndAcceptLoan(lendr, dummyERC721, 1, loanee);

      expect(claimCollateral(lendr, 1, loaner)).to.be.revertedWith(
        "Cannot claim collateral before lend period is over"
      );
    });

    it("should fail because offer has not been accepted", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      expect(claimCollateral(lendr, 1, loaner)).to.be.revertedWith(
        "You can only claim collateral on an accepted offer"
      );
    });
  });

  describe("Cancel Loans", function () {
    it("should cancel the loan successfully", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      const initialBalance = await dummyERC20.balanceOf(loaner.address);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await cancelLoanOffer(lendr, 1, loaner);

      // Ensure funds are returned
      expect(await dummyERC20.balanceOf(loaner.address)).to.be.equal(
        initialBalance
      );
    });

    it("should revert because only loaner can cancel", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      expect(cancelLoanOffer(lendr, 1, loanee)).to.be.revertedWith(
        "Only the creator can cancel the offer"
      );
    });

    it("should revert because only open offers can be cancelled", async function () {
      const { lendr, loaner, loanee, dummyERC20, dummyERC721 } =
        await loadFixture(deployContractsFixture);

      await approveTokensAndCreateLoan(
        lendr,
        dummyERC20,
        {
          loanee: loanee.address,
          collateralAddress: await dummyERC721.getAddress(),
          collateralId: 1,
          tokenAddress: await dummyERC20.getAddress(),
          numTokens: 1000,
          lendDuration: 1000,
        },
        loaner
      );

      await approveNFTsAndAcceptLoan(lendr, dummyERC721, 1, loanee);

      expect(cancelLoanOffer(lendr, 1, loanee)).to.be.revertedWith(
        "You can only cancel an open offer"
      );
    });
  });
});
