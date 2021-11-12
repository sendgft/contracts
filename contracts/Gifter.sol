// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IGifter.sol";

contract Gifter is ERC721Enumerable, IGifter, ReentrancyGuard {
  struct Gift {
    address sender;
    string message;
    bool claimed;
    uint ethAsWei;
    address[] erc20Tokens;
    uint[] erc20Amounts;
    address[] nftContracts;
    uint[] nftTokenIds;
  }

  mapping(uint => Gift) public gifts;
  uint public lastGiftId;

  constructor() ERC721("SENDGFT", "GFT") {}

  // IGifter

  function getVersion() external pure returns (string memory) {
    return "1";
  }

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
  ) {
    Gift storage g = gifts[_tokenId];
    sender_ = g.sender;
    claimed_ = g.claimed;
    recipient_ = ownerOf(_tokenId);
    message_ = g.message;
    ethAsWei_ = g.ethAsWei;
    erc20Tokens_ = g.erc20Tokens;
    erc20Amounts_ = g.erc20Amounts;
    nftContracts_ = g.nftContracts;
    nftTokenIds_ = g.nftTokenIds;
  }

  function claim(uint _tokenId) external nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    Gift storage g = gifts[_tokenId];

    // check and flip flag
    require(!g.claimed, "already claimed");
    g.claimed = true;

    // erc20
    uint i;
    for (i = 0; i < g.erc20Tokens.length; i += 1) {
      require(IERC20(g.erc20Tokens[i]).transfer(_msgSender(), g.erc20Amounts[i]), "ERC20 transfer failed");
    }

    // nfts
    for (i = 0; i < g.nftContracts.length; i += 1) {
      IERC721(g.nftContracts[i]).safeTransferFrom(address(this), _msgSender(), g.nftTokenIds[i]);
    }

    if (g.ethAsWei > 0) {
       payable(_msgSender()).transfer(g.ethAsWei);
    }
  }

  function send(
    address _recipient,
    string calldata _message,
    address[] calldata _erc20Tokens, 
    uint[] calldata _erc20Amounts,
    address[] calldata _nftContracts,
    uint[] calldata _nftTokenIds
  ) payable external {
    require(bytes(_message).length > 0, "empty message not allowed");

    // erc20
    uint i;
    for (i = 0; i < _erc20Tokens.length; i += 1) {
      require(IERC20(_erc20Tokens[i]).transferFrom(_msgSender(), address(this), _erc20Amounts[i]), "ERC20 transfer failed");
    }
    // nfts
    for (i = 0; i < _nftContracts.length; i += 1) {
      IERC721(_nftContracts[i]).safeTransferFrom(_msgSender(), address(this), _nftTokenIds[i]);
    }
    // save data
    lastGiftId += 1;
    gifts[lastGiftId] = Gift(
      _msgSender(), 
      _message, 
      false, 
      msg.value, 
      _erc20Tokens, 
      _erc20Amounts, 
      _nftContracts, 
      _nftTokenIds
    );
    // mint NFT
    _safeMint(_recipient, lastGiftId);
    // event
    emit NewGift(_recipient, lastGiftId);
  }
}