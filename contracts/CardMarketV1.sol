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

  struct Card {
    bool enabled;
    bool approved;
    address owner;
    string contentHash;
    address feeToken;
    uint feeAmount;
  }

  mapping(uint => Card) public cards;
  mapping(string => uint) public cardByCid;

  address public override dex;

  address[] private feeTokenList;
  mapping(address => bool) public feeTokenAllowed;

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
    return cards[_tokenId].contentHash;
  }

  // ICardMarket

  function setCardEnabled(uint _id, bool _enabled) external override isOwner(_id) {
    cards[_id].enabled = _enabled;
  }

  function setCardApproved(uint _id, bool _approved) external override isAdmin {
    cards[_id].approved = _approved;
  }

  function setDex(address _dex) external override isAdmin {
    dex = _dex;
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

  function addCard(string calldata _cid, address _feeToken, uint _feeAmount) external override isAdmin {
    require(feeTokenAllowed[_feeToken], "CardMarket: unsupported fee token");

    // new id
    lastId += 1;

    // check that card hasn't already been added
    require(cardByCid[_cid] == 0, "CardMarket: already added");
    cardByCid[_cid] = lastId;

    address sender = _msgSender();

    // save data
    cards[lastId] = Card(
      true,
      false,
      sender, 
      _cid,
      _feeToken,
      _feeAmount
    );

    // mint NFT
    _safeMint(sender, lastId);

    // event
    emit AddCard(lastId);
  }

  function useCard(uint _id) payable public override {
    Card storage card = cards[_id];

    require(card.approved, "CardMarket: card not approved");
    require(card.enabled, "CardMarket: card not enabled");

    IDex(dex).trade{value: msg.value}(
      card.feeToken, 
      card.feeAmount, 
      address(0), 
      msg.value, 
      address(dex), 
      address(this)
    );

    uint earned = ((10000 - tax) / 10000) * card.feeAmount;
    earnings[card.owner][card.feeToken] = earnings[card.owner][card.feeToken].add(earned);
    totalEarnings[card.feeToken] = totalEarnings[card.feeToken].add(earned);
    totalTaxes[card.feeToken] = totalTaxes[card.feeToken].add(card.feeAmount.sub(earned));

    emit UseCard(_id, card.feeToken, card.feeAmount, earned);
  }

  function withdrawTaxes(address _feeToken) external override isAdmin {
    uint amt = totalTaxes[_feeToken];
    if (amt > 0) {
      totalTaxes[_feeToken] = 0;
      require(IERC20(_feeToken).transfer(_msgSender(), amt), "CardMarket: taxes withdrawal failed");
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