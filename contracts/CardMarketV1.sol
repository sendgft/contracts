// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IProxyImplBase.sol";
import "./ICardMarket.sol";

contract CardMarketV1 is Initializable, ICardMarket, IProxyImplBase {
  struct Card {
    address creator;
    string contentHash;
    address feeToken;
    uint feeAmount;
  }

  mapping(uint => Card) public cards;

  // Initializable

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() ERC721("", "") {}

  function initialize() public initializer {
    _setTokenMeta("GFTCARD", "GFTCARD");
  }

  // IProxyImplBase

  function getVersion() external pure override returns (string memory) {
    return "1";
  }

  // INftBase

  function _getContentHash(uint256 _tokenId) internal view override returns (string memory) {
    return cards[_tokenId].contentHash;
  }

  // ICardMarket

  function addCard(string calldata _cid, address _feeToken, uint _feeAmount) external override {
    // new id
    lastId += 1;

    // save data
    cards[lastId] = Card(
      _msgSender(), 
      _cid,
      _feeToken,
      _feeAmount
    );

    // mint NFT
    _safeMint(msg.sender, lastId);

    // event
    emit Added(lastId);
  }
}