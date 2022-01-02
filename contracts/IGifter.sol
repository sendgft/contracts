// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGifter {
  /**
   * @dev Create a new gift to.
   *
   * Any ETH sent to this function will also get sent as part of the gift.
   *
   * @param _recipient The recipient.
   * @param _config The card configuration data.
   * @param _message The card message.
   * @param _numErc20s No. of ERC20/ERC777 token contract addresses.
   * @param _erc20AndNftContracts ERC20/ERC777 token contract addresses followed by NFT contract addresses.
   * @param _amountsAndIds ERC20/ERC777 token amounts followed by NFT ids.
  */
  function create(
    address _recipient, 
    bytes calldata _config,
    string calldata _message,
    uint _numErc20s,
    address[] calldata _erc20AndNftContracts, 
    uint[] calldata _amountsAndIds
  ) payable external;

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
   * @dev Get admin.
   *
   * @return address
   */
  function getAdmin() external view returns (address);

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