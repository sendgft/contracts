// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract DummyNFT is ERC721Enumerable {
  uint lastGiftId;

  constructor() ERC721("DUMMY", "DUM") {}

  function mint() public {
    lastGiftId += 1;
    _safeMint(_msgSender(), lastGiftId);
  }
}
