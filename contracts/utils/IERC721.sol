// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * See https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/token/ERC721
 */
interface IERC721 {
  function safeTransferFrom(
      address from,
      address to,
      uint256 tokenId
  ) external;  
}
