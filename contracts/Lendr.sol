// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Lendr is IERC721Receiver, ReentrancyGuard {
    enum LendOfferStatus {
        OPEN,
        ACCEPTED,
        CANCELLED,
        REPAID,
        COLLATERAL_CLAIMED
    }

    struct LendOffer {
        /* Loan Relationship Info */
        address creator;
        address loanee;
        /* Collateral Info */
        address collateralAddress;
        uint collateralId;
        /* Token Offer Info */
        address tokenAddress;
        uint numTokens;
        /* Status Info */
        uint lendDuration;
        LendOfferStatus status;
        uint offerAcceptedTs;
    }

    uint private counter = 0;
    mapping(uint => LendOffer) public lendOffers;

    struct CreateLendOfferRequest {
        address loanee;
        /* Collateral Info */
        address collateralAddress;
        uint collateralId;
        /* Token Offer Info */
        address tokenAddress;
        uint numTokens;
        uint lendDuration;
    }

    function createOffer(
        CreateLendOfferRequest calldata offerRequest
    ) external nonReentrant {
        require(offerRequest.numTokens > 0);
        require(offerRequest.lendDuration > 0);
        require(offerRequest.collateralId > 0);
        require(offerRequest.tokenAddress != address(0));
        require(offerRequest.collateralAddress != address(0));
        require(offerRequest.loanee != address(0));

        LendOffer memory offer = LendOffer({
            creator: msg.sender,
            loanee: offerRequest.loanee,
            collateralAddress: offerRequest.collateralAddress,
            collateralId: offerRequest.collateralId,
            tokenAddress: offerRequest.tokenAddress,
            numTokens: offerRequest.numTokens,
            lendDuration: offerRequest.lendDuration,
            status: LendOfferStatus.OPEN,
            offerAcceptedTs: 0
        });
        lendOffers[++counter] = offer;

        ERC20(offer.tokenAddress).transferFrom(
            msg.sender,
            address(this),
            offer.numTokens
        );
    }

    function acceptOffer(uint offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];

        require(
            msg.sender == offer.loanee,
            "Only the loanee can accept the offer"
        );
        require(
            offer.status == LendOfferStatus.OPEN,
            "The specified offer is not open"
        );

        ERC721 collateral = ERC721(offer.collateralAddress);
        collateral.safeTransferFrom(
            msg.sender,
            address(this),
            offer.collateralId
        );

        ERC20 token = ERC20(offer.tokenAddress);
        token.transfer(msg.sender, offer.numTokens);

        offer.status = LendOfferStatus.ACCEPTED;
        offer.offerAcceptedTs = block.timestamp;
    }

    function repayLoan(uint offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];

        require(
            msg.sender == offer.loanee,
            "Only the loanee can repay the loan"
        );
        require(
            offer.status == LendOfferStatus.ACCEPTED,
            "The specified offer has not been accepted"
        );

        // Pay the loan
        ERC20 token = ERC20(offer.tokenAddress);
        token.transferFrom(offer.loanee, offer.creator, offer.numTokens);

        // Return the collateral
        ERC721 collateral = ERC721(offer.collateralAddress);
        collateral.transferFrom(
            address(this),
            offer.loanee,
            offer.collateralId
        );

        offer.status = LendOfferStatus.REPAID;
    }

    function claimCollateral(uint offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];

        // Require that the duration has already passed.
        require(msg.sender == offer.creator, "Only owner can claim collateral");
        require(
            offer.status == LendOfferStatus.ACCEPTED,
            "You can only claim collateral on an accepted offer"
        );
        require(
            block.timestamp > offer.offerAcceptedTs + offer.lendDuration,
            "Cannot claim collateral before lend period is over"
        );

        ERC721 collateral = ERC721(offer.collateralAddress);
        collateral.safeTransferFrom(
            address(this),
            offer.creator,
            offer.collateralId
        );

        offer.status = LendOfferStatus.COLLATERAL_CLAIMED;
    }

    function cancelOffer(uint offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];

        require(
            msg.sender == offer.creator,
            "Only the creator can cancel the offer"
        );
        require(
            offer.status == LendOfferStatus.OPEN,
            "You can only cancel an open offer"
        );

        offer.status = LendOfferStatus.CANCELLED;

        ERC20 token = ERC20(offer.tokenAddress);
        token.transfer(msg.sender, offer.numTokens);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
