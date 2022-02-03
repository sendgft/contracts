// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

abstract contract IProxyImplBase is UUPSUpgradeable {
  modifier isAdmin() {
    require(msg.sender == _getAdmin(), 'must be admin');    
    _;
  }  

  function _authorizeUpgrade(address newImplementation) internal view override isAdmin {
    // cannot do zero address
    require(newImplementation != address(0), 'null implementation');
    // try calling getVersion() on new implementation
    try IProxyImplBase(newImplementation).getVersion() returns (string memory) {
      return;
    } catch {
      revert('invalid implementation');      
    }    
  }

  /**
   * @dev Get admin.
   *
   * @return address
   */
  function getAdmin() external view returns (address) {
    return _getAdmin();
  }

  /**
   * @dev Get Gifter version.
   * @return version string
   */
  function getVersion() external pure virtual returns (string memory);
}