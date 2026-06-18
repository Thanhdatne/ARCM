// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CollateralAllowlist is Ownable {
    mapping(address => bool) private allowedCollateral;

    event CollateralAllowed(address indexed collateral, bool allowed);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _transferOwnership(initialOwner);
    }

    function isCollateralAllowed(address collateral) external view returns (bool) {
        return allowedCollateral[collateral];
    }

    function setCollateralAllowed(address collateral, bool allowed) external onlyOwner {
        require(collateral != address(0), "Invalid collateral");
        allowedCollateral[collateral] = allowed;
        emit CollateralAllowed(collateral, allowed);
    }
}
