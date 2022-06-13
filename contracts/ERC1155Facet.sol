// SPDX-License-Identifier: MIT
// Based on OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/ERC1155.sol)
pragma solidity ^0.8.0;

import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { CustomIERC1155 } from "./utils/CustomIERC1155.sol";
import { CustomIERC1155MetadataURI } from "./utils/CustomIERC1155MetadataURI.sol";
import { LibDiamond } from "./diamond/libraries/LibDiamond.sol";
import { AppStorage, TokenType } from './Lib.sol';
import { BasePlusFacet } from './BasePlusFacet.sol';

contract ERC1155Facet is BasePlusFacet, CustomIERC1155, CustomIERC1155MetadataURI {
  using Address for address;

  // IERC165

  function supportsInterface(bytes4 _interfaceId) external override view returns (bool) {
    LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
    return ds.supportedInterfaces[_interfaceId];
  }  

  // CustomIERC1155MetadataURI

  function uri(uint id) public view virtual override returns (string memory) {
    TokenType t = s.tokens.types[id];
    if (t == TokenType.GIFT) {
      return string(abi.encodePacked(s.baseURI, s.gifts[id].contentHash));
    } else if (t == TokenType.CARD) {
      return string(abi.encodePacked(s.baseURI, s.cards[id].params.contentHash));
    } else {
      revert("ERC1155: invalid token");
    }
  }

  // CustomIERC1155

  function balanceOf(address account, uint id) public view virtual override returns (uint) {
    require(account != address(0), "ERC1155: address zero is not a valid owner");
    return s.tokens.balances[id][account];
  }

  function balanceOfBatch(address[] memory accounts, uint[] memory ids)
    public
    view
    virtual
    override
    returns (uint[] memory)
  {
    require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");

    uint[] memory batchBalances = new uint[](accounts.length);

    for (uint i = 0; i < accounts.length; ++i) {
      batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }

    return batchBalances;
  }

  function setApprovalForAll(address operator, bool approved) public virtual override {
    _setApprovalForAll(_msgSender(), operator, approved);
  }

  function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
    return s.tokens.operatorApprovals[account][operator];
  }

  function safeTransferFrom(
    address from,
    address to,
    uint id,
    uint amount,
    bytes memory data
  ) public virtual override {
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "ERC1155: caller is not token owner nor approved"
    );
    _safeTransferFrom(from, to, id, amount, data);
  }

  function safeBatchTransferFrom(
    address from,
    address to,
    uint[] memory ids,
    uint[] memory amounts,
    bytes memory data
  ) public virtual override {
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "ERC1155: caller is not token owner nor approved"
    );
    _safeBatchTransferFrom(from, to, ids, amounts, data);
  }

  // Internal methods

  function _safeTransferFrom(
    address from,
    address to,
    uint id,
    uint amount,
    bytes memory data
  ) internal virtual {
    require(to != address(0), "ERC1155: transfer to the zero address");

    address operator = _msgSender();

    uint fromBalance = s.tokens.balances[id][from];
    require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
    unchecked {
      s.tokens.balances[id][from] = fromBalance - amount;
    }
    s.tokens.balances[id][to] += amount;

    emit TransferSingle(operator, from, to, id, amount);

    _postSafeTransfer(operator, from, to, id, amount, data);
  }

  function _safeBatchTransferFrom(
    address from,
    address to,
    uint[] memory ids,
    uint[] memory amounts,
    bytes memory data
  ) internal virtual {
    require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
    require(to != address(0), "ERC1155: transfer to the zero address");

    address operator = _msgSender();

    for (uint i = 0; i < ids.length; ++i) {
      uint id = ids[i];
      uint amount = amounts[i];

      uint fromBalance = s.tokens.balances[id][from];
      require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
      unchecked {
          s.tokens.balances[id][from] = fromBalance - amount;
      }
      s.tokens.balances[id][to] += amount;
    }

    emit TransferBatch(operator, from, to, ids, amounts);

    _postSafeBatchTransfer(operator, from, to, ids, amounts, data);
  }

  function _setApprovalForAll(
    address owner,
    address operator,
    bool approved
  ) internal virtual {
    require(owner != operator, "ERC1155: setting approval status for self");
    s.tokens.operatorApprovals[owner][operator] = approved;
    emit ApprovalForAll(owner, operator, approved);
  }
}