// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IDex.sol";
import "./IERC20.sol";

contract DummyDex is IDex {
  // price = token1/token2: token1 => token2 => price
  mapping(address => mapping(address => uint)) public prices;

  // IDex

  function calcInAmount(address _outToken, uint _outAmount, address _inToken) public view returns (uint) {
    return prices[_outToken][_inToken] * _outAmount / 10**18;
  }

  function trade(address _outToken, uint _outAmount, address _inToken, uint _inAmount, address _inWallet, address _outWallet) external payable {
    uint requiredInAmount = calcInAmount(_outToken, _outAmount, _inToken);

    require(requiredInAmount <= _inAmount, "DummyDex: not enough input");

    uint actualOutputAmount = calcInAmount(_inToken, _inAmount, _outToken);

    if (_inToken != address(0)) {
      IERC20 input = IERC20(_inToken);
      require(input.transferFrom(_inWallet, address(this), _inAmount), "DummyDex: input transfer failed");
    } else {
      require(msg.value >= _inAmount, "DummyDex: input insufficient");
    }

    IERC20 output = IERC20(_outToken);
    require(output.transfer(_outWallet, actualOutputAmount), "DummyDex: output transfer failed");
  }

  // DummyDex

  /**
   * @dev Set the price of the input token amount to output token amount.
   *
   * @param _token1 Token 1.
   * @param _token2 Token 2.
   * @param _token1By2Price Token 1 / Token 2.
   * @param _token2By1Price Token 2 / Token 1.
   */
  function setPrice(address _token1, address _token2, uint _token1By2Price, uint _token2By1Price) external {
    uint const = 10**18;
    require((_token1By2Price * _token2By1Price) / const == const, "DummyDex: prices must correlate");
    prices[_token1][_token2] = _token1By2Price;
    prices[_token2][_token1] = _token2By1Price;
  }
}

