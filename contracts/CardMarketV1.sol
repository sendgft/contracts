// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./IERC20.sol";
import "./IProxyImplBase.sol";
import "./ICardMarket.sol";
import "./IDex.sol";
import "./IERC20.sol";

contract CardMarketV1 is Initializable, ICardMarket, IProxyImplBase {
  using SafeMath for uint;
  using ECDSA for bytes32;

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
    return card[_tokenId].params.contentHash;
  }

  // ICardMarket

  function setCardEnabled(uint _id, bool _enabled) external override isOwner(_id) {
    card[_id].enabled = _enabled;
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

  function calculateSignatureHash(string calldata contentHash) public pure override returns (bytes32) {
    return keccak256(abi.encode(contentHash));
  }

  function addCard(CardParams calldata _params, bytes calldata _adminApproval) external override {
    require(feeTokenAllowed[_params.fee.tokenContract], "CardMarket: unsupported fee token");

    // check approval
    address approver = calculateSignatureHash(_params.contentHash).toEthSignedMessageHash().recover(_adminApproval);
    require(_getAdmin() == approver, "CardMarket: must be approved by admin");

    // new id
    lastId += 1;

    // check that card hasn't already been added
    require(cardIdByCid[_params.contentHash] == 0, "CardMarket: already added");
    cardIdByCid[_params.contentHash] = lastId;

    // save data
    card[lastId] = Card(
      _params,
      true
    );

    // mint NFT
    _safeMint(_params.owner, lastId);

    // event
    emit AddCard(lastId);
  }

  function useCard(uint _id) payable public override {
    Card storage c = card[_id];
    GiftLib.Asset storage fee = c.params.fee;

    require(c.enabled, "CardMarket: card not enabled");

    dex.trade{value: msg.value}(
      fee.tokenContract, 
      fee.value, 
      address(this)
    );

    uint earned = (10000 - tax) * fee.value / 10000;
    earnings[c.params.owner][fee.tokenContract] = earnings[c.params.owner][fee.tokenContract].add(earned);
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