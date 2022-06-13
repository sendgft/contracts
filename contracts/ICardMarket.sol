// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CardParams, Asset } from "./Lib.sol";
import { IDex } from "./IDex.sol";


interface ICardMarket {
  /**
   * @dev Get card info.
   *
   * @param _id Card id.
   */
  function card(uint _id) view external returns (
    /* struct getter return values must be fully spelled out - https://github.com/ethereum/solidity/issues/11826 */
    CardParams memory params,
    bool enabled
  );

  /**
   * Get card id by CID.
   * 
   * @param _contentHash CID.
   */
  function cardIdByCid(string calldata _contentHash) view external returns (uint);

  /**
   * @dev Add a new card.
   *
   * The admin approval signature must be the `contentHash` signed by the admin's private key.
   *
   * @param _params Parameters.
   * @param _owner Card owner.
   * @param _adminApproval Admin approval signature.
   */
  function addCard(CardParams calldata _params, address _owner, bytes calldata _adminApproval) external;

  /**
   * @dev Set card fee.
   *
   * @param _fee Card fee.
   */
  function setCardFee(uint _id, Asset calldata _fee) external;

  /**
   * @dev Set a card as enabled or disabled.
   *
   * @param _id The card id.
   * @param _enabled true to enable, false to disable.
   */
  function setCardEnabled(uint _id, bool _enabled) external;

  /**
   * Calcualte hash for admins to digitally sign.
   * 
   * @param contentHash CID hash.
   */
  function calculateSignatureHash(string calldata contentHash) external pure returns (bytes32);

  /**
   * Get dex.
   */
  function dex() external view returns (IDex);

  /**
   * Set dex.
   *
   * @param _dex Dex to use.
   */
  function setDex(address _dex) external;

  /**
   * Get card usage tax.
   */
  function tax() external view returns (uint);

  /**
   * Set card usage tax.
   *
   * @param _tax Tax rate in basis points (100 = 1%).
   */
  function setTax(uint _tax) external;

  /**
   * Get allowed fee tokens.
   */
  function allowedFeeTokens() external view returns (address[] memory);

  /**
   * Get whether given token is allowed to be used as a fee token.
   *
   * @param _token The token.
   */
  function feeTokenAllowed(address _token) view external returns (bool);

  /**
   * Set allowed fee tokens.
   *
   * @param _feeTokens Allowed fee tokens.
   */
  function setAllowedFeeTokens(address[] calldata _feeTokens) external;

  /**
   * Get total accumulated withdrawable taxes.
   *
   * @param _feeToken The fee token.
   */
  function totalTaxes(address _feeToken) external view returns (uint);

  /**
   * Withdrawable accumulated taxes.
   *
   * @param _feeToken the fee token.
   */
  function withdrawTaxes(address _feeToken) external;

  /**
   * Get total accumulated withdrawable earnings for all wallets.
   *
   * @param _feeToken the fee token.
   */
  function totalEarnings(address _feeToken) external view returns (uint);

  /**
   * Get accumulated withdrawable earnings for given wallet.
   *
   * @param _wallet Wallet to check for.
   * @param _feeToken the fee token.
   */
  function earnings(address _wallet, address _feeToken) external view returns (uint);

  /**
   * Withdraw caller's accumulated earnings.
   *
   * @param _feeToken the fee token.
   */
  function withdrawEarnings(address _feeToken) external;

  /**
   * @dev Emitted when a new card gets added.
   * @param id The card NFT token id.
   */
  event AddCard( uint id );  
}