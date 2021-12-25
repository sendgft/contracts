// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IGifter.sol";

contract GifterImplementationV1 is Initializable, UUPSUpgradeable, ERC721Enumerable, ReentrancyGuard, IGifter, IERC721Receiver {
  struct GiftV1 {
    address sender;
    uint created;
    uint claimed;
    bool opened;
    bytes config;
    string contentHash;
    uint ethAsWei;
    uint numErc20s;
    address[] erc20AndNftContracts;
    uint[] amountsAndIds;
  }

  string private tokenName;
  string private tokenSymbol;
  string private baseURI;
  string private defaultContentHash;
  mapping(uint => GiftV1) public giftsV1;
  uint public lastGiftId;

  // Modifiers

  modifier isAdmin() {
    require(msg.sender == _getAdmin(), 'must be admin');    
    _;
  }

  // Initializable

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() ERC721("", "") {}

  function initialize() public initializer {
    tokenName = "SENDGFT";
    tokenSymbol = "GFT";
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
      GiftV1 storage g = giftsV1[_tokenId];
      return string(abi.encodePacked(baseURI, g.contentHash));
  }

  // UUPSUpgradeable

  function _authorizeUpgrade(address newImplementation) internal view override isAdmin {
    require(newImplementation != _getImplementation(), 'cannot upgrade to same');
  }

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

  // IGifter

  function getVersion() external pure returns (string memory) {
    return "1";
  }

  function setBaseURI(string calldata _baseURI) external isAdmin {
    baseURI = _baseURI;
  }

  function setDefaultContentHash(string calldata _contentHash) external isAdmin {
    defaultContentHash = _contentHash;
  }

  function claim(uint _tokenId) public nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    GiftV1 storage g = giftsV1[_tokenId];

    // check and flip flag
    require(g.claimed == 0, "already claimed");
    g.claimed = block.number;

    // erc20
    uint i;
    while (i < g.numErc20s) {
      require(IERC20(g.erc20AndNftContracts[i]).transfer(_msgSender(), g.amountsAndIds[i]), "ERC20 transfer failed");
      i += 1;
    }
    // nfts
    while (i < g.erc20AndNftContracts.length) {
      IERC721(g.erc20AndNftContracts[i]).safeTransferFrom(address(this), _msgSender(), g.amountsAndIds[i]);
      i += 1;
    }

    if (g.ethAsWei > 0) {
       payable(_msgSender()).transfer(g.ethAsWei);
    }

    emit Claimed(_tokenId);
  }

  function openAndClaim(uint _tokenId, string calldata _contentHash) external {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    GiftV1 storage g = giftsV1[_tokenId];

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
    bytes calldata _config,
    string calldata _message,
    uint _numErc20s,
    address[] calldata _erc20AndNftContracts, 
    uint[] calldata _amountsAndIds
  ) payable external {
    // erc20
    uint i = 0;
    while (i < _numErc20s) {
      require(IERC20(_erc20AndNftContracts[i]).transferFrom(_msgSender(), address(this), _amountsAndIds[i]), "ERC20 transfer failed");
      i += 1;
    }
    // nfts
    while (i < _erc20AndNftContracts.length) {
      IERC721(_erc20AndNftContracts[i]).safeTransferFrom(_msgSender(), address(this), _amountsAndIds[i]);
      i += 1;
    }
    // save data
    lastGiftId += 1;
    giftsV1[lastGiftId] = GiftV1(
      _msgSender(), 
      block.number,
      0, 
      false,
      _config,
      defaultContentHash,
      msg.value, 
      _numErc20s,
      _erc20AndNftContracts,
      _amountsAndIds
    );
    // mint NFT
    _safeMint(_recipient, lastGiftId);
    // event
    emit Created(lastGiftId, _message);
  }
}