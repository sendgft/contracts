// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./INftBase.sol";

abstract contract ICardMarket is INftBase {
  /**
   * @dev Add a new card.
   *
   * @param _cid The IPFS content hash.
   * @param _feeToken The token to pay the fee in.
   * @param _feeAmount The amount to pay as fee.
   */
  function addCard(string calldata _cid, address _feeToken, uint _feeAmount) external virtual;

  /**
   * @dev Emitted when a new card gets added.
   * @param tokenId The card NFT token id.
   */
  event Added(
    uint indexed tokenId
  );  
}