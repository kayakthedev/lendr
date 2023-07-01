// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyERC20 is ERC20("DummyERC20", "D20") {
    uint256 private _totalSupply = 1000000;

    constructor() {
        _mint(msg.sender, 10000);
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function mint(uint amount) external {
        _mint(msg.sender, amount);
    }
}
