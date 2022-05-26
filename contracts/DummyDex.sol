// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

import "./IDex.sol";
import "./IERC20.sol";

contract DummyDex is IDex {
  // price = native token/token
  mapping(address => uint) public prices;

  // IDex

  function calcInAmount(address _outToken, uint _outAmount) public view returns (uint) {
    return _outAmount * 10**18 / prices[_outToken];
  }

  function trade(address _outToken, uint _outAmount, address _outWallet) external payable {
    uint requiredInputAmount = calcInAmount(_outToken, _outAmount);
    require(msg.value >= requiredInputAmount, "DummyDex: input insufficient");
    IERC20 output = IERC20(_outToken);
    require(output.transfer(_outWallet, _outAmount), "DummyDex: output transfer failed");
  }

  // DummyDex

  /**
   * @dev Set the price of the token amount in the native token.
   *
   * @param _token Token.
   * @param _price No. of token per native token.
   */
  function setPrice(address _token, uint _price) external {
    prices[_token] = _price;
  }
}

