// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./IERC20.sol";
import "./IProxyImplBase.sol";
import "./ICardMarket.sol";
import "./IDex.sol";
import "./IERC20.sol";

contract CardMarketV1 is Initializable, ICardMarket, IProxyImplBase {
  using SafeMath for uint;

  mapping(uint => Card) public override card;
  mapping(string => uint) public override cardIdByCid;

  IDex public override dex;

  address[] private feeTokenList;
  mapping(address => bool) public override feeTokenAllowed;

  uint public override tax;
  // token => total
  mapping(address => uint) public override totalTaxes;

  // token => total
  mapping(address => uint) public override totalEarnings;
  // owner => token => total
  mapping(address => mapping(address => uint)) public override earnings;

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
    return card[_tokenId].contentHash;
  }

  // ICardMarket

  function setCardEnabled(uint _id, bool _enabled) external override isOwner(_id) {
    card[_id].enabled = _enabled;
  }

  function setCardApproved(uint _id, bool _approved) external override isAdmin {
    card[_id].approved = _approved;
  }

  function setDex(address _dex) external override isAdmin {
    dex = IDex(_dex);
  }

  function setTax(uint _tax) external override isAdmin {
    tax = _tax;
  }

  function allowedFeeTokens() external view override returns (address[] memory) {
    return feeTokenList;
  }

  function setAllowedFeeTokens(address[] calldata _feeTokens) external override isAdmin {
    for (uint i = 0; i < feeTokenList.length; i += 1) {
      feeTokenAllowed[feeTokenList[i]] = false;
    }

    feeTokenList = _feeTokens;

    for (uint i = 0; i < feeTokenList.length; i += 1) {
      feeTokenAllowed[feeTokenList[i]] = true;
    }
  }

  function addCard(CardParams calldata _params) external override {
    require(feeTokenAllowed[_params.fee.tokenContract], "CardMarket: unsupported fee token");

    // new id
    lastId += 1;

    // check that card hasn't already been added
    require(cardIdByCid[_params.contentHash] == 0, "CardMarket: already added");
    cardIdByCid[_params.contentHash] = lastId;

    address sender = _msgSender();

    // save data
    card[lastId] = Card(
      true,
      false,
      sender, 
      _params.contentHash,
      _params.fee
    );

    // mint NFT
    _safeMint(sender, lastId);

    // event
    emit AddCard(lastId);
  }

  function useCard(uint _id) payable public override {
    Card storage c = card[_id];
    GiftLib.Asset storage fee = c.fee;

    require(c.approved, "CardMarket: card not approved");
    require(c.enabled, "CardMarket: card not enabled");

    dex.trade{value: msg.value}(
      fee.tokenContract, 
      fee.value, 
      address(0), 
      address(this), 
      address(this)
    );

    uint earned = (10000 - tax) * fee.value / 10000;
    earnings[c.owner][fee.tokenContract] = earnings[c.owner][fee.tokenContract].add(earned);
    totalEarnings[fee.tokenContract] = totalEarnings[fee.tokenContract].add(earned);
    uint thisTax = fee.value.sub(earned);
    totalTaxes[fee.tokenContract] = totalTaxes[fee.tokenContract].add(thisTax);

    emit UseCard(_id, fee.value, earned, thisTax);
  }

  function withdrawTaxes(address _feeToken) external override isAdmin {
    uint amt = totalTaxes[_feeToken];
    if (amt > 0) {
      totalTaxes[_feeToken] = 0;
      require(IERC20(_feeToken).transfer(_msgSender(), amt), "CardMarket: tax withdrawal failed");
    }
  }

  function withdrawEarnings(address _feeToken) external override {
    address sender = _msgSender();
    uint amt = earnings[sender][_feeToken];
    if (amt > 0) {
      earnings[sender][_feeToken] = 0;
      totalEarnings[_feeToken] = totalEarnings[_feeToken].sub(amt);
      require(IERC20(_feeToken).transfer(sender, amt), "CardMarket: earnings withdrawal failed");
    }
  }

  function setBaseURI(string calldata _baseURI) external override isAdmin {
    _setBaseURI(_baseURI);
  }
}