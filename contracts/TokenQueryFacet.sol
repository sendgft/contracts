// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ITokenQuery } from "./ITokenQuery.sol";
import { BaseFacet } from "./BaseFacet.sol";
import { TokenType } from './Lib.sol';

contract TokenQueryFacet is BaseFacet, ITokenQuery {
  function tokenOwner(uint _id) view external override returns (address) {
    require(s.tokens.types[_id] != TokenType.INVALID, "Gifter: cannot have owner");
    return s.tokens.owner[_id];
  }
  
  function totalTokensByType(TokenType _type) view external override returns (uint) {
    return s.tokens.totalByType[_type];
  }

  function tokenByType(TokenType _type, uint _index) view external override returns (uint) {
    return s.tokens.byType[_type][_index];
  }
  
  function totalTokensOwnedByType(TokenType _type, address _owner) view external override returns (uint) {
    return s.tokens.totalOwnedByType[_owner][_type];
  }

  function tokenOwnedByType(TokenType _type, address _owner, uint _index) view external override returns (uint) {
    return s.tokens.ownedIdByTypeAndIndex[_owner][_type][_index];
  }
}