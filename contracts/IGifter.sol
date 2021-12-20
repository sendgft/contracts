// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGifter {
  /**
   * @dev Send a new gift to someone.
   *
   * Any ETH sent to this function will also get sent as part of the gift.
   *
   * @param _recipient The recipient.
   * @param _config The card configuration data.
   * @param _erc20Contracts ERC20/ERC777 token contract addresses.
   * @param _erc20Amounts ERC20/ERC777 token amounts.
   * @param _nftContracts NFT contract addresses.
   * @param _nftTokenIds NFT token ids.
  */
  function send(
    address _recipient, 
    bytes calldata _config,
    address[] calldata _erc20Contracts, 
    uint[] calldata _erc20Amounts,
    address[] calldata _nftContracts,
    uint[] calldata _nftTokenIds
  ) payable external;

  /**
   * @dev Open the gift and claim the assets within.
   *
   * @param _tokenId The gift token id.
   * @param _contentHash The decentralized content hash for fetching the metadata representing the opened card.
   */
  function openAndClaim(uint _tokenId, string calldata _contentHash) external;

  /**
   * @dev Get Gifter version.
   * @return version string
   */
  function getVersion() external pure returns (string memory);

  /**
   * Set Base URIs for token URIs.
   * 
   * @param _baseURI New base URI.
   */
  function setBaseURI(string calldata _baseURI) external;

  /**
   * Set default decentralized content hash for cards.
   *
   * The decentralied content hash is used to fetch the metadata representing an un-opened card.
   * 
   * @param _contentHash New default content hash.
   */
  function setDefaultContentHash(string calldata _contentHash) external;

  /**
   * @dev Emitted when a new gift gets created.
   * @param tokenId The gift NFT token id.
   * @param config Card config data.
   */
  event NewGift(
    uint indexed tokenId,
    bytes config
  );  

  /**
   * @dev Emitted when a gift gets opened.
   * @param tokenId The gift NFT token id.
   */
  event Opened(
    uint indexed tokenId
  );  
}