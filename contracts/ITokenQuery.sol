// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CardParams, Asset, TokenType } from "./Lib.sol";
import { IDex } from "./IDex.sol";


interface ITokenQuery {
  /**
   * @dev Get token owner.
  */
  function tokenOwner(uint _id) view external returns (address);

  /**
   * @dev Get total no. of of tokens of given type.
   *
   * @param _type type.
  */
  function totalTokensByType(TokenType _type) view external returns (uint);

  /**
   * @dev Get id of token of given type at given index.
   *
   * @param _type type.
   * @param _index 1-based index in list of tokens of given type.
   */
  function tokenByType(TokenType _type, uint _index) view external returns (uint);
  
  /**
   * @dev Get total no. of tokens of given type owned by given account.
   *
   * @param _type type.
   * @param _owner owner.
   */
  function totalTokensOwnedByType(TokenType _type, address _owner) view external returns (uint);

  /**
   * @dev Get id of token of given type owned by given account at given index.
   *
   * @param _type type.
   * @param _owner owner.
   * @param _index 1-based index in list of tokens of given type owned by the account.
   */
  function tokenOwnedByType(TokenType _type, address _owner, uint _index) view external returns (uint);
}