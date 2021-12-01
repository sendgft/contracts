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
    string message;
    bool claimed;
    uint ethAsWei;
    address[] erc20Tokens;
    uint[] erc20Amounts;
    address[] nftContracts;
    uint[] nftTokenIds;
  }

  string private _name;
  string private _symbol;
  mapping(uint => GiftV1) public giftsV1;
  uint public lastGiftId;

  // Initializable

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() ERC721("", "") {}

  function initialize() public initializer {
    _name = "SENDGFT";
    _symbol = "GFT";
  }

  function name() public view override returns (string memory) {
    return _name;
  }

  function symbol() public view override returns (string memory) {
    return _symbol;
  }

  // UUPSUpgradeable

  function _authorizeUpgrade(address newImplementation) internal view override {
    require(msg.sender == _getAdmin(), 'only admin can upgrade');
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

  function claim(uint _tokenId) external nonReentrant {
    require(_msgSender() == ownerOf(_tokenId), "must be owner");

    GiftV1 storage g = giftsV1[_tokenId];

    // check and flip flag
    require(!g.claimed, "already claimed");
    g.claimed = true;

    // erc20
    uint i;
    for (i = 0; i < g.erc20Tokens.length; i += 1) {
      require(IERC20(g.erc20Tokens[i]).transfer(_msgSender(), g.erc20Amounts[i]), "ERC20 transfer failed");
    }

    // nfts
    for (i = 0; i < g.nftContracts.length; i += 1) {
      IERC721(g.nftContracts[i]).safeTransferFrom(address(this), _msgSender(), g.nftTokenIds[i]);
    }

    if (g.ethAsWei > 0) {
       payable(_msgSender()).transfer(g.ethAsWei);
    }

    emit Claimed(_tokenId, _msgSender());
  }

  function send(
    address _recipient,
    string calldata _message,
    address[] calldata _erc20Tokens, 
    uint[] calldata _erc20Amounts,
    address[] calldata _nftContracts,
    uint[] calldata _nftTokenIds
  ) payable external {
    require(bytes(_message).length > 0, "empty message not allowed");

    // erc20
    uint i;
    for (i = 0; i < _erc20Tokens.length; i += 1) {
      require(IERC20(_erc20Tokens[i]).transferFrom(_msgSender(), address(this), _erc20Amounts[i]), "ERC20 transfer failed");
    }
    // nfts
    for (i = 0; i < _nftContracts.length; i += 1) {
      IERC721(_nftContracts[i]).safeTransferFrom(_msgSender(), address(this), _nftTokenIds[i]);
    }
    // save data
    lastGiftId += 1;
    giftsV1[lastGiftId] = GiftV1(
      _msgSender(), 
      _message, 
      false, 
      msg.value, 
      _erc20Tokens, 
      _erc20Amounts, 
      _nftContracts, 
      _nftTokenIds
    );
    // mint NFT
    _safeMint(_recipient, lastGiftId);
    // event
    emit NewGift(lastGiftId, _msgSender(), _recipient);
  }
}