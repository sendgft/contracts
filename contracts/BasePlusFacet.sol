// SPDX-License-Identifier: MIT
// Based on OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/ERC1155.sol)
pragma solidity ^0.8.0;


import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { BaseFacet } from "./BaseFacet.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { AppStorage ,TokenType } from './Lib.sol';


abstract contract BasePlusFacet is BaseFacet {
  using Address for address;

  /**
    * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
    * Taken from IERC115
    */
  event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

  function _mint(
    address to,
    uint id,
    uint amount,
    bytes memory data,
    TokenType tokenType
  ) internal virtual {
    require(to != address(0), "ERC1155: mint to the zero address");

    address operator = _msgSender();

    s.tokens.balances[id][to] += amount;
    emit TransferSingle(operator, address(0), to, id, amount);

    s.tokens.types[id] = tokenType;
    s.tokens.totalByType[tokenType] += 1;
    s.tokens.byType[tokenType][s.tokens.totalByType[tokenType]] = id;

    _postSafeTransfer(operator, address(0), to, id, amount, data);
  }

  function _postSafeTransfer(
    address operator,
    address from,
    address to,
    uint id,
    uint amount,
    bytes memory data
  ) internal {
    if (to.isContract()) {
      try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
        if (response != IERC1155Receiver.onERC1155Received.selector) {
          revert("ERC1155: ERC1155Receiver rejected tokens");
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert("ERC1155: transfer to non ERC1155Receiver implementer");
      }
    }

    _updateTokenOwnerInfo(from, to, id);
  }

  function _postSafeBatchTransfer(
    address operator,
    address from,
    address to,
    uint[] memory ids,
    uint[] memory amounts,
    bytes memory data
  ) internal {
    if (to.isContract()) {
      try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (
        bytes4 response
      ) {
        if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
          revert("ERC1155: ERC1155Receiver rejected tokens");
        }
      } catch Error(string memory reason) {
        revert(reason);
      } catch {
        revert("ERC1155: transfer to non ERC1155Receiver implementer");
      }
    }

    for (uint i = 0; i < ids.length; i += 1) {
      if (s.tokens.types[ids[i]] != TokenType.INVALID) {
        _updateTokenOwnerInfo(from, to, ids[i]);
      }
    }
  }

  function _updateTokenOwnerInfo(address from, address to, uint id) internal {
    TokenType t = s.tokens.types[id];
    require(t != TokenType.INVALID, "Token type must be set");
    
    if (from != address(0)) {
      uint total = s.tokens.totalOwnedByType[from][t];
      uint ind = s.tokens.ownedIndexByTypeAndId[from][t][id];
      s.tokens.ownedIndexByTypeAndId[from][t][id] = 0;
      if (ind < total) {
        s.tokens.ownedIdByTypeAndIndex[from][t][ind] = s.tokens.ownedIdByTypeAndIndex[from][t][total];
        s.tokens.ownedIdByTypeAndIndex[from][t][total] = 0;
      }
      s.tokens.totalOwnedByType[from][t] -= 1;
    }

    s.tokens.totalOwnedByType[to][t] += 1;
    uint toTotal = s.tokens.totalOwnedByType[to][t];
    s.tokens.ownedIndexByTypeAndId[to][t][id] = toTotal;
    s.tokens.ownedIdByTypeAndIndex[to][t][toTotal] = id;

    s.tokens.owner[id] = to;
  }
}