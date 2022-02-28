// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDex {
  /**
   * @dev Calculate the minimum input token amount required to trade to the given output token amount.
   *
   * @param _outToken The output token.
   * @param _outAmount The minimum required output amount.
   * @param _inToken The input token.
   */
  function calcInAmount(address _outToken, uint _outAmount, address _inToken) external view returns (uint);

  /**
   * @dev Trade the input token amount to output token amount.
   *
   * @param _outToken The output token.
   * @param _outAmount The minimum required output amount.
   * @param _inToken The input token.
   * @param _inAmount The input amount.
   * @param _inWallet The wallet to take input tokens from.
   * @param _outWallet The wallet to send output tokens to.
   */
  function trade(address _outToken, uint _outAmount, address _inToken, uint _inAmount, address _inWallet, address _outWallet) external payable;
}