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

  function swapExactAVAXForTokens(
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline    
  ) external payable;
}

// DEX interface for Avalanche Mainnet
contract AvaxDex is IDex {
  address constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
  IJoeRouter constant Joe = IJoeRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
  
  // IDex

  function calcInAmount(address _outToken, uint _outAmount) public view returns (uint) {
    uint[] memory ins = Joe.getAmountsIn(_outAmount, _getPath(WAVAX, _outToken));
    return ins[0];
  }

  function trade(address _outToken, uint _outAmount, address _outWallet) external payable {
    uint requiredInputAmount = calcInAmount(_outToken, _outAmount);
    require(msg.value >= requiredInputAmount, "AvalancheDex: input insufficient");
    Joe.swapExactAVAXForTokens{value: msg.value}(_outAmount, _getPath(WAVAX, _outToken), _outWallet, block.timestamp + 120);
  }

  // private

  function _getPath(address _token1, address _token2) private pure returns (address[] memory) {
    address[] memory a = new address[](2);
    a[0] = _token1;
    a[1] = _token2;
    return a;
  }
}

