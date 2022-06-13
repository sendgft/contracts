// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ITokenQuery } from "./ITokenQuery.sol";
import { ICardMarket } from "./ICardMarket.sol";
import { IGifter } from "./IGifter.sol";
import { CustomIERC1155MetadataURI } from "./utils/CustomIERC1155MetadataURI.sol";

interface IMaster is IGifter, ICardMarket, ITokenQuery, CustomIERC1155MetadataURI {}
