// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./ICardMarket.sol";
import "./IProxyImplBase.sol";
import "./IGifter.sol";

contract GifterV1 is Initializable, ReentrancyGuard, IGifter, IProxyImplBase {
  using SafeMath for uint;

  mapping(uint => GiftData) public gifts;
  string public defaultContentHash;
  ICardMarket public cardMarket;

  // Initializable

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() ERC721("", "") {}

  function initialize() public initializer {
    _setTokenMeta("GFT", "GFT");
  }

  // IProxyImplBase

  function getVersion() external pure override returns (string memory) {
    return "1";
  }

  // INftBase

  function _getContentHash(uint256 _tokenId) internal view override returns (string memory) {
    return gifts[_tokenId].contentHash;
  }

  // IGifter

  function setDefaultContentHash(string calldata _contentHash) external override isAdmin {
    defaultContentHash = _contentHash;
  }

  function setCardMarket(address _cardMarket) external override isAdmin {
    cardMarket = ICardMarket(_cardMarket);
  }

  function claim(uint _tokenId) public override isOwner(_tokenId) nonReentrant {
    GiftData storage g = gifts[_tokenId];

    // check and flip flag
    require(g.claimed == 0, "Gifter: already claimed");
    g.claimed = block.number;

    // erc20
    for (uint i = 0; i < g.params.erc20.length; i += 1) {
      GiftAsset storage asset = g.params.erc20[i];
      require(IERC20(asset.tokenContract).transfer(_msgSender(), asset.value), "ERC20 transfer failed");
    }

    // nft
    for (uint i = 0; i < g.params.nft.length; i += 1) {
      GiftAsset storage asset = g.params.nft[i];
      IERC721(asset.tokenContract).safeTransferFrom(address(this), _msgSender(), asset.value);
    } 

    // wei
    if (g.params.weiValue > 0) {
      payable(_msgSender()).transfer(g.params.weiValue);
    }

    emit Claimed(_tokenId);
  }

  function openAndClaim(uint _tokenId, string calldata _contentHash) external override isOwner(_tokenId) {
    GiftData storage g = gifts[_tokenId];

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
    lastId += 1;

    // save data
    GiftData storage g = gifts[lastId];
    g.sender = sender;
    g.created = block.number;
    g.contentHash = defaultContentHash;
    g.params.config = _params.config;
    g.params.recipient = _params.recipient;
    g.params.message = _params.message;
    g.params.weiValue = _params.weiValue;
    g.params.fee = _params.fee;

    // erc20
    for (uint i = 0; i < _params.erc20.length; i += 1) {
      GiftAsset calldata asset = _params.erc20[i];
      require(IERC20(asset.tokenContract).transferFrom(_msgSender(), address(this), asset.value), "ERC20 transfer failed");
      g.params.erc20.push(asset);
    }

    // nft
    for (uint i = 0; i < _params.nft.length; i += 1) {
      GiftAsset calldata asset = _params.nft[i];
      IERC721(asset.tokenContract).safeTransferFrom(_msgSender(), address(this), asset.value);
      g.params.nft.push(asset);
    }

    // mint NFT
    _safeMint(_params.recipient, lastId);

    // check and pay card design fee
    uint256 cardDesignId;
    bytes memory config = g.params.config;
    assembly {
      cardDesignId := mload(config)
    }
    cardMarket.useCard{value: msg.value.sub(_params.weiValue)}(cardDesignId);

    // event
    emit Created(lastId, _params.message);
  }

  function setBaseURI(string calldata _baseURI) external override isAdmin {
    _setBaseURI(_baseURI);
  }
}