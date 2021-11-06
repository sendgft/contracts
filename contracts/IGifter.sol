// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGifter {
  /**
   * @dev Send a new gift to someone.
   *
   * Any ETH sent to this function will also get sent as part of the gift.
   *
   * @param _recipient The recipient.
   * @param _message The message to send.
   * @param _erc20Tokens ERC20/ERC777 token contract addresses.
   * @param _erc20Amounts ERC20/ERC777 token amounts.
   * @param _nftContracts NFT contract addresses.
   * @param _nftTokenIds NFT token ids.
   */
  function send(
    address _recipient, 
    string calldata _message,
    address[] calldata _erc20Tokens, 
    uint[] calldata _erc20Amounts,
    address[] calldata _nftContracts,
    uint[] calldata _nftTokenIds
  ) payable external;

  /**
   * @dev Claim the contents of a gift.
   *
   * @param _tokenId The gift token id.
   */
  function claim(uint _tokenId) external;

  /**
   * @dev Get Gifter version.
   * @return version string
   */
  function getVersion() external pure returns (string memory);

  /**
   * @dev Emitted when a new gift gets sent.
   * @param recipient The recipient.
   * @param tokenId The gift NFT token id.
   */
  event NewGift(
    address indexed recipient,
    uint indexed tokenId
  );  
}