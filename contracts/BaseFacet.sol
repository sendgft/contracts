// SPDX-License-Identifier: MIT
// Based on OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/ERC1155.sol)
pragma solidity ^0.8.0;

import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { LibDiamond } from './diamond/libraries/LibDiamond.sol';
import { AppStorage ,TokenType } from './Lib.sol';

abstract contract BaseFacet is Context {
  AppStorage internal s;

  function _getAdmin() internal view returns (address) {
    return LibDiamond.contractOwner();
  }
  
  function _getNewTokenId() internal returns (uint) {
    s.tokens.lastId += 1;
    return s.tokens.lastId;
  }

  modifier isAdmin () {
    require(_msgSender() == _getAdmin(), "Gifter: must be admin");
    _;
  }

  modifier isOwner (uint _id) {
    require(s.tokens.balances[_id][_msgSender()] == 1, "Gifter: must be owner");
    _;
  }
}