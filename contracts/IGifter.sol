// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { GiftParams } from "./Lib.sol";

interface IGifter {
  /**
   * @dev Get gift info.
   *
   * @param _id Gift id.
   */
  function gift(uint _id) view external returns (
    /* struct getter return values must be fully spelled out - https://github.com/ethereum/solidity/issues/11826 */
    GiftParams memory params,
    address sender,
    uint timestamp,
    uint created,
    uint claimed,
    bool opened,
    string memory contentHash
  );

  /**
   * Get total no. of GFTs sent by given sender.
   *
   * @param _sender The sender.
   */
  function totalSent(address _sender) view external returns (uint);

  /**
   * Get GFT at given index sent by given sender.
   *
   * @param _sender The sender.
   * @param _index 0-based index.
   */
  function sent(address _sender, uint _index) view external returns (uint);

  /**
   * @dev Create a new gift.
   *
   * @param _params Gift params.
  */
  function create(GiftParams calldata _params) payable external;

  /**
   * @dev Claim the assets within the gift without opening it.
   *
   * @param _tokenId The gift token id.
   */
  function claim(uint _tokenId) external;

  /**
   * @dev Open the gift and claim the assets within.
   *
   * @param _tokenId The gift token id.
   * @param _contentHash The decentralized content hash for fetching the metadata representing the opened card.
   */
  function openAndClaim(uint _tokenId, string calldata _contentHash) external;

  /**
   * Get default decentralized content hash for gifts.
   */
  function defaultGiftContentHash() external view returns (string memory);

  /**
   * Set default decentralized content hash for gifts.
   *
   * The decentralied content hash is used to fetch the metadata representing an un-opened card.
   * 
   * @param _contentHash New default content hash.
   */
  function setDefaultGiftContentHash(string calldata _contentHash) external;

  /**
   * Get base URI for all metadata URIs.
   */
  function baseURI() external view returns (string memory);

  /**
   * Set base URI for all metadata URIs.
   * @param _baseURI base URI.
   */
  function setBaseURI(string calldata _baseURI) external;

  /**
   * @dev Emitted when a new gift gets created.
   * @param id The gift token id.
   * @param message Card message.
   */
  event Created(
    uint indexed id,
    string message
  );  

  /**
   * @dev Emitted when a gift gets claimed.
   * @param id The gift token id.
   */
  event Claimed(
    uint indexed id
  );  

  /**
   * @dev Emitted when a card gets used.
   * @param cardId The card NFT token id.
   * @param fee The total fee.
   * @param earned The actual fee earned by owner.
   * @param tax The actual tax taken from the fee.
   */
  event UseCard(
    uint cardId,
    uint fee,
    uint earned,
    uint tax
  );  
}