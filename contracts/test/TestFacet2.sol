// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ITestFacet } from './ITestFacet.sol';

contract TestFacet2 is ITestFacet{
  function getTestUint() pure external returns (uint) {
    return 456;
  }
}
