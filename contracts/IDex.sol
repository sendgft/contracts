// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDex {
  /**
   * @dev Calculate the minimum native token amount required to trade to the given output token amount.
   *
   * @param _outToken The output token.
   * @param _outAmount The minimum required output amount.
   */
  function calcInAmount(address _outToken, uint _outAmount) external view returns (uint);

  /**
   * @dev Trade the received native token amount to the output token amount.
   *
   * @param _outToken The output token.
   * @param _outAmount The minimum required output amount.
   * @param _outWallet The wallet to send output tokens to.
   */
  function trade(address _outToken, uint _outAmount, address _outWallet) external payable;
}