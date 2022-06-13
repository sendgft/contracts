// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Asset {
  address tokenContract;
  uint value;
}

struct GiftParams {
  address recipient;
  bytes config;
  string message;
  uint weiValue;
  Asset fee;
  Asset[] erc20;
  Asset[] nft;
}

struct GiftData {
  GiftParams params;
  address sender;
  uint timestamp;
  uint created;
  uint claimed;
  bool opened; 
  string contentHash;
}

struct CardParams {
  string contentHash;
  Asset fee;
}

struct Card {
  CardParams params;
  bool enabled;
}

enum TokenType { INVALID, GIFT, CARD }

struct Tokens {
  uint lastId;
  mapping(uint => string) URIs;
  mapping(uint => mapping(address => uint)) balances;
  mapping(address => mapping(address => bool)) operatorApprovals;
  // token owner
  mapping(uint => address) owner;
  // token types
  mapping(uint => TokenType) types;
  // total tokens by types
  mapping(TokenType => uint) totalByType;
  // token by type
  mapping(TokenType => mapping(uint => uint)) byType;
  // owner => type => total tokens
  mapping (address => mapping(TokenType => uint)) totalOwnedByType;
  // owner => type => index => token id
  mapping (address => mapping(TokenType => mapping(uint => uint))) ownedIdByTypeAndIndex;
  // owner => type => token id => index
  mapping (address => mapping(TokenType => mapping(uint => uint))) ownedIndexByTypeAndId;
}

struct AppStorage {
  // Generic token stuff
  Tokens tokens;
  // base URI for all metadata
  string baseURI;
  // default content hash for newly sent gifts
  string defaultGiftContentHash;
  // DEX address
  address dex;
  // list of allowed tokens for card fee denominations
  address[] feeTokenList;
  // token => allowed for use as fee token
  mapping(address => bool) isFeeTokenAllowed;
  // fee tax (platform revenue) in basis points
  uint tax;
  // gift id => data
  mapping(uint => GiftData) gifts;
  // sender => total sent
  mapping (address => uint) totalGiftsSent;
  // sender => sent index => gift id
  mapping (address => mapping(uint => uint)) sentGift;
  // card id => data
  mapping(uint => Card) cards;
  // content hash => card id
  mapping(string => uint) cardIdByContentHash;
  // token => total tax
  mapping(address => uint) totalTaxesPerToken;
  // token => total earnings
  mapping(address => uint) totalEarningsPerToken;
  // owner => token => total
  mapping(address => mapping(address => uint)) cardOwnerEarningsPerToken;
}

