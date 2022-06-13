// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import { IDiamondCut } from "./diamond/interfaces/IDiamondCut.sol";
import { IERC173 } from "./diamond/interfaces/IERC173.sol";
import { Diamond } from "./diamond/Diamond.sol";
import { LibDiamond } from "./diamond/libraries/LibDiamond.sol";
import { AppStorage } from './Lib.sol';

contract Gifter is Diamond {
  AppStorage internal s;

  constructor(address _contractOwner, address _diamondCutFacet) payable Diamond(_contractOwner, _diamondCutFacet) {
    LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
    ds.supportedInterfaces[type(IERC165).interfaceId] = true;
    ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
    ds.supportedInterfaces[type(IERC173).interfaceId] = true;
    ds.supportedInterfaces[type(IERC1155).interfaceId] = true;
    ds.supportedInterfaces[type(IERC1155Receiver).interfaceId] = true;
    ds.supportedInterfaces[type(IERC1155MetadataURI).interfaceId] = true;
  }
}