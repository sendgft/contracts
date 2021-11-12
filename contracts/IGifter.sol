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
   * @dev Get gift info.
   *
   * @param _tokenId The gift token id.
   *
   * @return sender_ The sender.
   * @return claimed_ Whether gift has been claimed.
   * @return recipient_ Gift recipient.
   * @return message_ Gift message.
   * @return ethAsWei_ Amount of ETH attached to gift.
   * @return erc20Tokens_ ERC20 token contract addresses.
   * @return erc20Amounts_ ERC20 token amounts.
   * @return nftContracts_ NFT contract addresses.
   * @return nftTokenIds_ NFT token ids.
   */
  function getGift(uint _tokenId) external view returns (
    address sender_,
    bool claimed_,
    address recipient_, 
    string memory message_,
    uint256 ethAsWei_,
    address[] memory erc20Tokens_, 
    uint[] memory erc20Amounts_,
    address[] memory nftContracts_,
    uint[] memory nftTokenIds_
  );

  /**
   * @dev Get Gifter version.
   * @return version string
   */
  function getVersion() external pure returns (string memory);

  /**
   * @dev Emitted when a new gift gets sent.
   * @param tokenId The gift NFT token id.
   * @param sender The sender.
   * @param recipient The recipient.
   */
  event NewGift(
    uint indexed tokenId,
    address indexed sender,
    address indexed recipient
  );  

  /**
   * @dev Emitted when a gift gets claimed.
   * @param tokenId The gift NFT token id.
   * @param owner The gift owner.
   */
  event Claimed(
    uint indexed tokenId,
    address indexed owner
  );  
}