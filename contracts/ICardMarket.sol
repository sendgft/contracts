// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./INftBase.sol";
import "./IDex.sol";
import "./GiftLib.sol";


abstract contract ICardMarket is INftBase {
  struct Card {
    bool enabled;
    bool approved;
    address owner;
    string contentHash;
    GiftLib.Asset fee;
  }

  struct CardParams {
    string contentHash;
    GiftLib.Asset fee;
  }

  /**
   * @dev Get card info.
   *
   * @param _id Card id.
   */
  function card(uint _id) view external virtual returns (
    /* struct getter return values must be fully spelled out - https://github.com/ethereum/solidity/issues/11826 */
    bool enabled,
    bool approved,
    address owner,
    string memory contentHash,
    GiftLib.Asset memory fee
  );

  /**
   * Get card id by CID.
   * 
   * @param _cid CID.
   */
  function cardIdByCid(string calldata _cid) view external virtual returns (uint);

  /**
   * @dev Add a new card.
   *
   * @param _params Parameters.
   */
  function addCard(CardParams calldata _params) external virtual;

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
  function dex() external view virtual returns (IDex);

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
   * Get whether given token is allowed to be used as a fee token.
   *
   * @param _token The token.
   */
  function feeTokenAllowed(address _token) view external virtual returns (bool);

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
   */
  function useCard(uint _id) payable external virtual;

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
   * @param fee The total fee.
   * @param earned The actual fee earned by owner.
   * @param tax The actual tax taken from the fee.
   */
  event UseCard(
    uint tokenId,
    uint fee,
    uint earned,
    uint tax
  );  
}