// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IGifter.sol";

contract Gifter is ERC721Enumerable, IGifter, ReentrancyGuard {
  struct Gift {
    bool claimed;
    uint eth;
    string message;
    address[] erc20Tokens;
    uint[] erc20Amounts;
    address[] nftContracts;
    uint[] nftTokenIds;
  }

  mapping(uint => Gift) public gifts;
  uint public lastGiftId;

  constructor() ERC721("GFT.XYZ", "GFT") {}

  // IGifter

  function getVersion() external pure returns (string memory) {
    return "1";
  }

  function claim(uint _tokenId) external nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");
    require(!gifts[_tokenId].claimed, "already claimed");

    // flip flag
    gifts[_tokenId].claimed = true;

    // erc20
    uint i;
    while (i < gifts[_tokenId].erc20Tokens.length) {
      require(IERC20(gifts[_tokenId].erc20Tokens[i]).transfer(_msgSender(), gifts[_tokenId].erc20Amounts[i]), "ERC20 transfer failed");
    }

    // nfts
    i = 0;
    while (i < gifts[_tokenId].nftContracts.length) {
      IERC721(gifts[_tokenId].nftContracts[i]).safeTransferFrom(address(this), _msgSender(), gifts[_tokenId].nftTokenIds[i]);
    }

    if (gifts[_tokenId].eth > 0) {
       payable(_msgSender()).transfer(gifts[_tokenId].eth);
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
    // erc20
    uint i;
    while (i < _erc20Tokens.length) {
      require(IERC20(_erc20Tokens[i]).transferFrom(_msgSender(), address(this), _erc20Amounts[i]), "ERC20 transfer failed");
    }
    // nfts
    i = 0;
    while (i < _nftContracts.length) {
      IERC721(_nftContracts[i]).safeTransferFrom(_msgSender(), address(this), _nftTokenIds[i]);
    }
    // save data
    lastGiftId += 1;
    gifts[lastGiftId] = Gift(false, msg.value, _message, _erc20Tokens, _erc20Amounts, _nftContracts, _nftTokenIds);
    // mint NFT
    _safeMint(_recipient, lastGiftId);
    // event
    emit NewGift(_recipient, lastGiftId);
  }
}