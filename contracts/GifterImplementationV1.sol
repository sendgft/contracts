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
    bool claimed;
    bytes config;
    string contentHash;
    uint ethAsWei;
    address[] erc20Contracts;
    uint[] erc20Amounts;
    address[] nftContracts;
    uint[] nftTokenIds;
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

  function openAndClaim(uint _tokenId, string calldata _contentHash) external nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    GiftV1 storage g = giftsV1[_tokenId];

    // check and flip flag
    require(!g.claimed, "already claimed");
    g.claimed = true;

    // set content hash
    g.contentHash = _contentHash;

    // erc20
    uint i;
    for (i = 0; i < g.erc20Contracts.length; i += 1) {
      require(IERC20(g.erc20Contracts[i]).transfer(_msgSender(), g.erc20Amounts[i]), "ERC20 transfer failed");
    }

    // nfts
    for (i = 0; i < g.nftContracts.length; i += 1) {
      IERC721(g.nftContracts[i]).safeTransferFrom(address(this), _msgSender(), g.nftTokenIds[i]);
    }

    if (g.ethAsWei > 0) {
       payable(_msgSender()).transfer(g.ethAsWei);
    }

    emit Opened(_tokenId);
  }

  function send(
    address _recipient,
    bytes calldata _config,
    address[] calldata _erc20Contracts, 
    uint[] calldata _erc20Amounts,
    address[] calldata _nftContracts,
    uint[] calldata _nftTokenIds
  ) payable external {
    // erc20
    uint i;
    for (i = 0; i < _erc20Contracts.length; i += 1) {
      require(IERC20(_erc20Contracts[i]).transferFrom(_msgSender(), address(this), _erc20Amounts[i]), "ERC20 transfer failed");
    }
    // nfts
    for (i = 0; i < _nftContracts.length; i += 1) {
      IERC721(_nftContracts[i]).safeTransferFrom(_msgSender(), address(this), _nftTokenIds[i]);
    }
    // save data
    lastGiftId += 1;
    giftsV1[lastGiftId] = GiftV1(
      _msgSender(), 
      false, 
      _config,
      defaultContentHash,
      msg.value, 
      _erc20Contracts, 
      _erc20Amounts, 
      _nftContracts, 
      _nftTokenIds
    );
    // mint NFT
    _safeMint(_recipient, lastGiftId);
    // event
    emit NewGift(lastGiftId, _config);
  }
}