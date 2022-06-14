// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IERC721 } from "./utils/IERC721.sol";
import { IERC20 } from "./utils/IERC20.sol";
import { ICardMarket } from "./ICardMarket.sol";
import { IGifter } from "./IGifter.sol";
import { BasePlusFacet } from "./BasePlusFacet.sol";
import { IDex } from "./IDex.sol";
import { AppStorage, GiftParams, GiftData, Asset, Card, TokenType } from './Lib.sol';

contract GifterFacet is BasePlusFacet, IGifter, IERC721Receiver {
  using SafeMath for uint;

  // IGifter

  function gift(uint _id) view external override returns (
    GiftParams memory params,
    address sender,
    uint timestamp,
    uint created,
    uint claimed,
    bool opened,
    string memory contentHash
  ) {
    params = s.gifts[_id].params;
    sender = s.gifts[_id].sender;
    timestamp = s.gifts[_id].timestamp;
    created = s.gifts[_id].created;
    claimed = s.gifts[_id].claimed;
    opened = s.gifts[_id].opened;
    contentHash = s.gifts[_id].contentHash;
  }

  function totalSent(address _sender) view external override returns (uint) {
    return s.totalGiftsSent[_sender];
  }

  function sent(address _sender, uint _index) view external override returns (uint) {
    return s.sentGift[_sender][_index];
  }

  function defaultGiftContentHash() external view returns (string memory) {
    return s.defaultGiftContentHash;
  }

  function setDefaultGiftContentHash(string calldata _contentHash) external override isAdmin {
    s.defaultGiftContentHash = _contentHash;
  }

  function baseURI() external view returns (string memory) {
    return s.baseURI;
  }

  function setBaseURI(string calldata _baseURI) external override isAdmin {
    s.baseURI = _baseURI;
  }

  function claim(uint _tokenId) public override isOwner(_tokenId) {
    GiftData storage g = s.gifts[_tokenId];

    // check and flip flag
    require(g.claimed == 0, "Gifter: already claimed");
    g.claimed = block.number;

    // erc20
    for (uint i = 0; i < g.params.erc20.length; i += 1) {
      Asset storage asset = g.params.erc20[i];
      require(IERC20(asset.tokenContract).transfer(_msgSender(), asset.value), "ERC20 transfer failed");
    }

    // nft
    for (uint i = 0; i < g.params.nft.length; i += 1) {
      Asset storage asset = g.params.nft[i];
      IERC721(asset.tokenContract).safeTransferFrom(address(this), _msgSender(), asset.value);
    } 

    // wei
    if (g.params.weiValue > 0) {
      payable(_msgSender()).transfer(g.params.weiValue);
    }

    emit Claimed(_tokenId);
  }

  function openAndClaim(uint _tokenId, string calldata _contentHash) external override isOwner(_tokenId) {
    GiftData storage g = s.gifts[_tokenId];

    // check and flip flag
    require(!g.opened, "Gifter: already opened");
    g.opened = true;
    g.contentHash = _contentHash;

    if (g.claimed == 0) {
      claim(_tokenId);
    }
  }

  function create(GiftParams calldata _params) payable external override {
    address sender = _msgSender();

    // new gift id
    uint id = _getNewTokenId();

    // save data
    GiftData storage g = s.gifts[id];
    g.sender = sender;
    g.created = block.number;
    g.timestamp = block.timestamp;
    g.contentHash = s.defaultGiftContentHash;
    g.params.config = _params.config;
    g.params.recipient = _params.recipient;
    g.params.weiValue = _params.weiValue;
    g.params.fee = _params.fee;

    // erc20
    for (uint i = 0; i < _params.erc20.length; i += 1) {
      Asset calldata asset = _params.erc20[i];
      require(IERC20(asset.tokenContract).transferFrom(_msgSender(), address(this), asset.value), "ERC20 transfer failed");
      g.params.erc20.push(asset);
    }

    // nft
    for (uint i = 0; i < _params.nft.length; i += 1) {
      Asset calldata asset = _params.nft[i];
      IERC721(asset.tokenContract).safeTransferFrom(_msgSender(), address(this), asset.value);
      g.params.nft.push(asset);
    }

    // mint NFT
    _mint(_params.recipient, id, 1, bytes(""), TokenType.GIFT);

    // check and pay card design fee
    uint cardId;
    bytes memory config = g.params.config;
    assembly {
      cardId := mload(add(config, 0x20))
    }

    _useCard(cardId, msg.value.sub(_params.weiValue));

    // update sender info
    s.totalGiftsSent[sender] += 1;
    s.sentGift[sender][s.totalGiftsSent[sender]] = id;

    // event
    emit Created(id, _params.message);
  }

  // IERC721Receiver

  function onERC721Received(
      address /*operator*/,
      address /*from*/,
      uint256 /*tokenId*/,
      bytes calldata /*data*/
  ) external pure returns (bytes4) {
    return IERC721Receiver.onERC721Received.selector;
  }

  // Private methods

  function _useCard(uint _id, uint _inputFee) private {
    Card storage c = s.cards[_id];
    Asset storage fee = c.params.fee;

    require(c.enabled, "Gifter: card not enabled");

    IDex(s.dex).trade{value: _inputFee}(
      fee.tokenContract, 
      fee.value, 
      address(this)
    );

    uint earned = (10000 - s.tax) * fee.value / 10000;
    address o = s.tokens.owner[_id];
    s.cardOwnerEarningsPerToken[o][fee.tokenContract] = s.cardOwnerEarningsPerToken[o][fee.tokenContract].add(earned);
    s.totalEarningsPerToken[fee.tokenContract] = s.totalEarningsPerToken[fee.tokenContract].add(earned);
    uint thisTax = fee.value.sub(earned);
    s.totalTaxesPerToken[fee.tokenContract] = s.totalTaxesPerToken[fee.tokenContract].add(thisTax);

    emit UseCard(_id, fee.value, earned, thisTax);
  }
}