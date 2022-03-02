// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./INftBase.sol";

abstract contract ICardMarket is INftBase {
  /**
   * @dev Add a new card.
   *
   * @param _cid The IPFS content hash.
   * @param _feeToken The fee token.
   * @param _feeAmount The amount to pay as fee.
   */
  function addCard(string calldata _cid, address _feeToken, uint _feeAmount) external virtual;

  /**
   * @dev Set a card as enabled or disabled.
   *
   * @param _id The card id.
   * @param _enabled true to enable, false to disable.
   */
  function setCardEnabled(uint _id, bool _enabled) external virtual;

  /**
   * @dev Set a card as approved or disapproved.
   *
   * @param _id The card id.
   * @param _approved true to approve, false to disapprove.
   */
  function setCardApproved(uint _id, bool _approved) external virtual;

  /**
   * Get dex.
   */
  function dex() external view virtual returns (address);

  /**
   * Set dex.
   *
   * @param _dex Dex to use.
   */
  function setDex(address _dex) external virtual;

  /**
   * Get card usage tax.
   */
  function tax() external view virtual returns (uint);

  /**
   * Set card usage tax.
   *
   * @param _tax Tax rate in basis points (100 = 1%).
   */
  function setTax(uint _tax) external virtual;

  /**
   * Get allowed fee tokens.
   */
  function allowedFeeTokens() external view virtual returns (address[] memory);

  /**
   * Set allowed fee tokens.
   *
   * @param _feeTokens Allowed fee tokens.
   */
  function setAllowedFeeTokens(address[] calldata _feeTokens) external virtual;

  /**
   * Use given card for a gift.
   *
   * @param _id The card id.
   * @param _feePayer The wallet that will pay the fee.
   * @param _feeToken The token in which fees are being paid.
   */
  function useCard(uint _id, address _feePayer, address _feeToken) payable external virtual;

  /**
   * Set base URI.
   * @param _baseURI base URI.
   */
  function setBaseURI(string calldata _baseURI) external virtual;

  /**
   * Get total accumulated withdrawable taxes.
   *
   * @param _feeToken The fee token.
   */
  function totalTaxes(address _feeToken) external view virtual returns (uint);

  /**
   * Withdrawable accumulated taxes.
   *
   * @param _feeToken the fee token.
   */
  function withdrawTaxes(address _feeToken) external virtual;

  /**
   * Get total accumulated withdrawable earnings for all wallets.
   *
   * @param _feeToken the fee token.
   */
  function totalEarnings(address _feeToken) external view virtual returns (uint);

  /**
   * Get accumulated withdrawable earnings for given wallet.
   *
   * @param _wallet Wallet to check for.
   * @param _feeToken the fee token.
   */
  function earnings(address _wallet, address _feeToken) external view virtual returns (uint);

  /**
   * Withdraw caller's accumulated earnings.
   *
   * @param _feeToken the fee token.
   */
  function withdrawEarnings(address _feeToken) external virtual;

  /**
   * @dev Emitted when a new card gets added.
   * @param tokenId The card NFT token id.
   */
  event AddCard(
    uint tokenId
  );  

  /**
   * @dev Emitted when a card gets used.
   * @param tokenId The card NFT token id.
   * @param feeToken The card fee token.
   * @param feeAmount The card fee amount.
   * @param earned The actual fee amount earned.
   */
  event UseCard(
    uint tokenId,
    address feeToken,
    uint feeAmount,
    uint earned
  );  
}