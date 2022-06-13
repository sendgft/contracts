// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DummyToken is IERC20, Context {
  using SafeMath for *;

  mapping (address => uint256) private balances;
  mapping (address => mapping (address => uint256)) private allowances;
  string public name;
  string public symbol;
  uint8 public decimals;
  uint256 public totalSupply;

  constructor (string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply) {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    totalSupply = _initialSupply;
    balances[_msgSender()] = _initialSupply;
  }

  function balanceOf(address account) public view returns (uint256) {
      return balances[account];
  }

  function transfer(address recipient, uint256 amount) public returns (bool) {
      _transfer(_msgSender(), recipient, amount);
      return true;
  }

  function allowance(address owner, address spender) public view returns (uint256) {
      return allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public returns (bool) {
      _approve(_msgSender(), spender, amount);
      return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
      _approve(sender, _msgSender(), allowances[sender][_msgSender()].sub(amount, "DummyToken: transfer amount exceeds allowance"));
      _transfer(sender, recipient, amount);
      return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal {
      require(recipient != address(0), "DummyToken: transfer to the zero address");

      balances[sender] = balances[sender].sub(amount, "DummyToken: transfer amount exceeds balance");
      balances[recipient] = balances[recipient].add(amount);
      emit Transfer(sender, recipient, amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
      require(spender != address(0), "DummyToken: approve to the zero address");

      allowances[owner][spender] = amount;
      emit Approval(owner, spender, amount);
  }

  function mint(address _recipient, uint _numTokensWei) public {
      balances[_recipient] = balances[_recipient].add(_numTokensWei);
      totalSupply = totalSupply.add(_numTokensWei);
  }
}
