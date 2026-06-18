// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./MockERC20Decimals.sol";

contract MockFeeOnTransferERC20 is MockERC20Decimals {
    uint256 public constant FEE_BPS = 100;
    bool public feesEnabled = true;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        MockERC20Decimals(name_, symbol_, decimals_)
    {}

    function setFeesEnabled(bool enabled) external {
        feesEnabled = enabled;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override {
        if (!feesEnabled) {
            super._transfer(sender, recipient, amount);
            return;
        }
        uint256 fee = amount * FEE_BPS / 10_000;
        super._transfer(sender, recipient, amount - fee);
        if (fee > 0) _burn(sender, fee);
    }
}
