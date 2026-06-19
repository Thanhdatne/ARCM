// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IEventBasedPredictionMarketV2 {
    function contractVersion() external view returns (uint256);
    function collateralToken() external view returns (address);
    function collateralDecimals() external view returns (uint8);
    function outcomeDecimals() external view returns (uint8);
    function collateralAllowlist() external view returns (address);
    function longToken() external view returns (address);
    function shortToken() external view returns (address);
    function pairName() external view returns (string memory);
    function customAncillaryData() external view returns (bytes memory);
    function priceIdentifier() external view returns (bytes32);
    function requestTimestamp() external view returns (uint256);
    function priceRequested() external view returns (bool);
    function receivedSettlementPrice() external view returns (bool);
    function settlementPrice() external view returns (uint256);
    function proposerReward() external view returns (uint256);
    function optimisticOracleLivenessTime() external view returns (uint256);
    function optimisticOracleProposerBond() external view returns (uint256);
    function initializeMarket() external;
    function create(uint256 amount) external;
    function redeem(uint256 amount) external;
    function settle(uint256 yesAmount, uint256 noAmount) external returns (uint256 collateralReturned);
}
