// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

import "./IDex.sol";
import "./IERC20.sol";

// @see https://github.com/traderjoe-xyz/joe-core/blob/main/contracts/traderjoe/JoeRouter02.sol
interface IJoeRouter {
  function getAmountsIn(
    uint256 amountOut, address[] memory path
  ) external view returns (uint256[] memory amounts);

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline    
  ) external;

  function swapExactAVAXForTokens(
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline    
  ) external payable;
}

contract AvalancheDex is IDex {
  address constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
  IJoeRouter constant Joe = IJoeRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
  
  // IDex

  function calcInAmount(address _outToken, uint _outAmount, address _inToken) public view returns (uint) {
    uint[] memory ins = Joe.getAmountsIn(_outAmount, _getPath(_inToken, _outToken));
    return ins[1];
  }

  function trade(address _outToken, uint _outAmount, address _inToken, address _inWallet, address _outWallet) external payable {
    uint requiredInputAmount = calcInAmount(_outToken, _outAmount, _inToken);

    if (_inToken != address(0)) {
      IERC20 input = IERC20(_inToken);
      require(input.transferFrom(_inWallet, address(this), requiredInputAmount), "AvalancheDex: input transfer failed");
      Joe.swapExactTokensForTokens(requiredInputAmount, _outAmount, _getPath(_inToken, _outToken), _outWallet, block.timestamp + 120);
    } else {
      require(msg.value >= requiredInputAmount, "AvalancheDex: input insufficient");
      Joe.swapExactAVAXForTokens{value: msg.value}(_outAmount, _getPath(WAVAX, _outToken), _outWallet, block.timestamp + 120);
    }
  }

  // private

  function _getPath(address _token1, address _token2) private pure returns (address[] memory) {
    address[] memory a = new address[](2);
    a[0] = _token1;
    a[1] = _token2;
    return a;
  }
}

