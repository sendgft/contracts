// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ECDSA } from  "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { IERC20 } from "./utils/IERC20.sol";
import { ICardMarket } from "./ICardMarket.sol";
import { IDex } from "./IDex.sol";
import { BasePlusFacet } from "./BasePlusFacet.sol";
import { CardParams, Asset, Card, TokenType } from "./Lib.sol";

contract CardMarketFacet is BasePlusFacet, ICardMarket {
  using SafeMath for uint;
  using ECDSA for bytes32;

  // ICardMarket

  function card(uint _id) view external override returns (CardParams memory params, bool enabled) {
    params = s.cards[_id].params;
    enabled = s.cards[_id].enabled;
  }

  function cardIdByCid(string calldata _contentHash) view external override returns (uint) {
    return s.cardIdByContentHash[_contentHash];
  }

  function setCardEnabled(uint _id, bool _enabled) external override isOwner(_id) {
    s.cards[_id].enabled = _enabled;
  }

  function setCardFee(uint _id, Asset calldata _fee) external override isOwner(_id) {
    s.cards[_id].params.fee = _fee;
  }

  function dex() external view override returns (IDex) {
    return IDex(s.dex);
  }

  function setDex(address _dex) external override isAdmin {
    s.dex = _dex;
  }

  function tax() external view override returns (uint) {
    return s.tax;
  }

  function setTax(uint _tax) external override isAdmin {
    s.tax = _tax;
  }

  function totalTaxes(address _feeToken) external view override returns (uint) {
    return s.totalTaxesPerToken[_feeToken];
  }

  function allowedFeeTokens() external view override returns (address[] memory) {
    return s.feeTokenList;
  }

  function feeTokenAllowed(address _token) view external override returns (bool) {
    return s.isFeeTokenAllowed[_token];
  }

  function setAllowedFeeTokens(address[] calldata _feeTokens) external override isAdmin {
    for (uint i = 0; i < s.feeTokenList.length; i += 1) {
      s.isFeeTokenAllowed[s.feeTokenList[i]] = false;
    }

    s.feeTokenList = _feeTokens;

    for (uint i = 0; i < s.feeTokenList.length; i += 1) {
      s.isFeeTokenAllowed[s.feeTokenList[i]] = true;
    }
  }

  function totalEarnings(address _feeToken) external view override returns (uint) {
    return s.totalEarningsPerToken[_feeToken];
  }

  function earnings(address _wallet, address _feeToken) external view override returns (uint) {
    return s.cardOwnerEarningsPerToken[_wallet][_feeToken];
  }

  function calculateSignatureHash(string calldata contentHash) public pure override returns (bytes32) {
    return keccak256(abi.encode(contentHash));
  }

  function addCard(CardParams calldata _params, address _owner, bytes calldata _adminApproval) external override {
    require(s.isFeeTokenAllowed[_params.fee.tokenContract], "Gifter: unsupported fee token");

    // check approval
    address approver = calculateSignatureHash(_params.contentHash).toEthSignedMessageHash().recover(_adminApproval);
    require(_getAdmin() == approver, "Gifter: must be approved by admin");

    // new id
    uint id = _getNewTokenId();

    // check that card hasn't already been added
    require(s.cardIdByContentHash[_params.contentHash] == 0, "Gifter: card already added");
    s.cardIdByContentHash[_params.contentHash] = id;

    // save data
    s.cards[id] = Card(
      _params,
      true
    );

    // mint NFT
    _mint(_owner, id, 1, bytes(""), TokenType.CARD);

    // event
    emit AddCard(id);
  }

  function withdrawTaxes(address _feeToken) external override isAdmin {
    uint amt = s.totalTaxesPerToken[_feeToken];
    if (amt > 0) {
      s.totalTaxesPerToken[_feeToken] = 0;
      require(IERC20(_feeToken).transfer(_msgSender(), amt), "Gifter: tax withdrawal failed");
    }
  }

  function withdrawEarnings(address _feeToken) external override {
    address sender = _msgSender();
    uint amt = s.cardOwnerEarningsPerToken[sender][_feeToken];
    if (amt > 0) {
      s.cardOwnerEarningsPerToken[sender][_feeToken] = 0;
      s.totalEarningsPerToken[_feeToken] = s.totalEarningsPerToken[_feeToken].sub(amt);
      require(IERC20(_feeToken).transfer(sender, amt), "Gifter: earnings withdrawal failed");
    }
  }
}