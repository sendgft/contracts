// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

abstract contract INftBase is IERC721, IERC721Receiver, ERC721Enumerable {
  string internal tokenName;
  string internal tokenSymbol;
  uint public lastId;
  string public baseURI;

  // IERC721Receiver

  function onERC721Received(
    address /*operator*/,
    address /*from*/,
    uint256 /*tokenId*/,
    bytes calldata /*data*/
  ) external pure returns (bytes4) {
    // confirm transfer (see https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721Receiver.sol)
    return IERC721Receiver.onERC721Received.selector;
  }  

  // IERC721Metadata

  function name() public view override returns (string memory) {
    return tokenName;
  }

  function symbol() public view override returns (string memory) {
    return tokenSymbol;
  }

  function tokenURI(uint256 _tokenId) public view override returns (string memory) {
    require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token");
    string memory hash = _getContentHash(_tokenId);    
    return string(abi.encodePacked(baseURI, hash));
  }

  // INftBase

  function setBaseURI(string calldata _baseURI) external {
    baseURI = _baseURI;
  }

  function _setTokenMeta(string memory _name, string memory _symbol) internal {
    tokenName = _name;
    tokenSymbol = _symbol;
  }

  /**
   * @dev Get content hash of given token.
   * @return content hash
   */
  function _getContentHash(uint256 _tokenId) internal view virtual returns (string memory);
}