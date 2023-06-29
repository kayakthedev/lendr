// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DummyERC721 is ERC721("DummyERC721", "D721") {
    constructor() {
        _safeMint(msg.sender, 1);
        _safeMint(msg.sender, 2);
        _safeMint(msg.sender, 3);
        _safeMint(msg.sender, 4);
    }
}
