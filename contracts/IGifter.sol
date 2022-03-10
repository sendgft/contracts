// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./INftBase.sol";

abstract contract IGifter is INftBase {
  struct GiftAsset {
    address tokenContract;
    uint value;
  }

  struct GiftParams {
    address recipient;
    bytes config;
    string message;
    uint weiValue;
    GiftAsset fee;
    GiftAsset[] erc20;
    GiftAsset[] nft;
  }

  struct GiftData {
    GiftParams params;
    address sender;
    uint created;
    uint claimed;
    bool opened; 
    string contentHash;
  }

  /**
   * @dev Create a new gift.
   *
   * @param _params Gift params.
  */
  function create(GiftParams calldata _params) payable external virtual;

  /**
   * @dev Claim the assets within the gift without opening it.
   *
   * @param _tokenId The gift token id.
   */
  function claim(uint _tokenId) external virtual;

  /**
   * @dev Open the gift and claim the assets within.
   *
   * @param _tokenId The gift token id.
   * @param _contentHash The decentralized content hash for fetching the metadata representing the opened card.
   */
  function openAndClaim(uint _tokenId, string calldata _contentHash) external virtual;

  /**
   * Set default decentralized content hash for cards.
   *
   * The decentralied content hash is used to fetch the metadata representing an un-opened card.
   * 
   * @param _contentHash New default content hash.
   */
  function setDefaultContentHash(string calldata _contentHash) external virtual;

  /**
   * Set card market.
   *
   * @param _cardMarket card market address.
   */
  function setCardMarket(address _cardMarket) external virtual;

  /**
   * Set base URI.
   * @param _baseURI base URI.
   */
  function setBaseURI(string calldata _baseURI) external virtual;

  /**
   * @dev Emitted when a new gift gets created.
   * @param tokenId The gift NFT token id.
   * @param message Card message.
   */
  event Created(
    uint indexed tokenId,
    string message
  );  

  /**
   * @dev Emitted when a gift gets claimed.
   * @param tokenId The gift NFT token id.
   */
  event Claimed(
    uint indexed tokenId
  );  
}