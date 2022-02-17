// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICardMarket.sol";
import "./IProxyImplBase.sol";
import "./IGifter.sol";

contract GifterV1 is Initializable, ReentrancyGuard, IGifter, IProxyImplBase {
  struct Gift {
    address sender;
    uint created;
    uint claimed;
    bool opened;
    bytes config;
    string contentHash;
    uint ethAsWei;
    uint numErc20s;
    uint numNfts;
  }

  struct GiftAsset {
    address tokenContract;
    uint value;
  }

  string public defaultContentHash;

  ICardMarket public cardMarket;

  mapping(uint => Gift) public gifts;
  mapping(uint => GiftAsset[]) public giftAssets;

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

  function claim(uint _tokenId) public override nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    Gift storage gift = gifts[_tokenId];
    GiftAsset[] storage assets = giftAssets[_tokenId];

    // check and flip flag
    require(gift.claimed == 0, "already claimed");
    gift.claimed = block.number;

    // assets
    for (uint i = 0; i < assets.length; i += 1) {
      // nfts
      if (i >= gift.numErc20s) {
        IERC721(assets[i].tokenContract).safeTransferFrom(address(this), _msgSender(), assets[i].value);
      } 
      // erc20
      else {
        require(IERC20(assets[i].tokenContract).transfer(_msgSender(), assets[i].value), "ERC20 transfer failed");
      }
    }

    if (gift.ethAsWei > 0) {
       payable(_msgSender()).transfer(gift.ethAsWei);
    }

    emit Claimed(_tokenId);
  }

  function openAndClaim(uint _tokenId, string calldata _contentHash) external override {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    Gift storage g = gifts[_tokenId];

    // check and flip flag
    require(!g.opened, "already opened");
    g.opened = true;

    g.contentHash = _contentHash;

    if (g.claimed == 0) {
      claim(_tokenId);
    }
  }

  function create(
    address _recipient,
    bytes memory _config,
    string calldata _message,
    uint _numErc20s,
    address[] calldata _erc20AndNftContracts, 
    uint[] calldata _amountsAndIds
  ) payable external override {
    // new gift id
    lastId += 1;

    // assets
    for (uint i = 0; i < _erc20AndNftContracts.length; i += 1) {
      // nfts
      if (i >= _numErc20s) {
        IERC721(_erc20AndNftContracts[i]).safeTransferFrom(_msgSender(), address(this), _amountsAndIds[i]);
      }
      // erc20
      else {
        require(IERC20(_erc20AndNftContracts[i]).transferFrom(_msgSender(), address(this), _amountsAndIds[i]), "ERC20 transfer failed");
      }

      giftAssets[lastId].push(GiftAsset(
        _erc20AndNftContracts[i],
        _amountsAndIds[i]
      ));
    }

    // save data
    gifts[lastId] = Gift(
      _msgSender(), 
      block.number,
      0, 
      false,
      _config,
      defaultContentHash,
      msg.value, 
      _numErc20s,
      _erc20AndNftContracts.length - _numErc20s
    );

    // mint NFT
    _safeMint(_recipient, lastId);

    // check and pay card design fee
    uint256 cardDesignId;
    assembly {
      cardDesignId := mload(add(_config, 0x20) /* we skip first slot since that stores the length */)
    }
    cardMarket.useCard(cardDesignId);

    // event
    emit Created(lastId, _message);
  }
}