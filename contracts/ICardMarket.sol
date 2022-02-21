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
   * @dev Set a card as enabled or disabled.
   *
   * @param _id The card id.
   * @param _enabled true to enable, false to disable.
   */
  function setCardEnabled(uint _id, bool _enabled) external virtual;

  /**
   * Use given card for a gift.
   *
   * @param _id The card id.
   */
  function useCard(uint _id) payable external virtual;

  /**
   * Set base URI.
   * @param _baseURI base URI.
   */
  function setBaseURI(string calldata _baseURI) external virtual;

  /**
   * @dev Emitted when a new card gets added.
   * @param tokenId The card NFT token id.
   */
  event Added(
    uint indexed tokenId
  );  
}