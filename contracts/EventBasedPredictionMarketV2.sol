// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uma/core/contracts/common/implementation/AddressWhitelist.sol";
import "@uma/core/contracts/common/implementation/ExpandedERC20.sol";
import "@uma/core/contracts/common/implementation/Testable.sol";
import "@uma/core/contracts/data-verification-mechanism/implementation/Constants.sol";
import "@uma/core/contracts/data-verification-mechanism/interfaces/IdentifierWhitelistInterface.sol";
import "@uma/core/contracts/optimistic-oracle-v2/interfaces/OptimisticOracleV2Interface.sol";

import "./CollateralAllowlist.sol";

contract EventBasedPredictionMarketV2 is Testable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant contractVersion = 2;
    uint256 private constant PRICE_SCALE = 1e18;

    bool public priceRequested;
    bool public receivedSettlementPrice;
    uint256 public requestTimestamp;
    string public pairName;
    uint256 public settlementPrice;
    bytes32 public priceIdentifier = "YES_OR_NO_QUERY";
    int256 public expiryPrice;

    IERC20Metadata public immutable collateralToken;
    uint8 public immutable collateralDecimals;
    uint8 public immutable outcomeDecimals;
    ExpandedIERC20 public longToken;
    ExpandedIERC20 public shortToken;
    FinderInterface public finder;
    CollateralAllowlist public immutable collateralAllowlist;

    bytes public customAncillaryData;
    uint256 public proposerReward;
    uint256 public optimisticOracleLivenessTime;
    uint256 public optimisticOracleProposerBond;

    event TokensCreated(address indexed sponsor, uint256 collateralUsed, uint256 longTokensMinted, uint256 shortTokensMinted);
    event TokensRedeemed(address indexed sponsor, uint256 collateralReturned, uint256 longTokensBurned, uint256 shortTokensBurned);
    event PositionSettled(address indexed sponsor, uint256 collateralReturned, uint256 longTokens, uint256 shortTokens, uint256 settlementPrice);
    event MarketInitialized(uint256 requestTimestamp);
    event PriceDisputed(uint256 oldTimestamp, uint256 newTimestamp);

    modifier requestInitialized() {
        require(priceRequested, "Price not requested");
        _;
    }

    constructor(
        string memory _pairName,
        address _collateralToken,
        bytes memory _customAncillaryData,
        FinderInterface _finder,
        address _timerAddress,
        uint256 _proposerReward,
        uint256 _optimisticOracleLivenessTime,
        uint256 _optimisticOracleProposerBond,
        address _collateralAllowlist
    ) Testable(_timerAddress) {
        require(_collateralToken != address(0) && _collateralToken.code.length > 0, "Invalid collateral");
        require(_collateralAllowlist != address(0) && _collateralAllowlist.code.length > 0, "Invalid allowlist");

        collateralAllowlist = CollateralAllowlist(_collateralAllowlist);
        require(collateralAllowlist.isCollateralAllowed(_collateralToken), "Collateral not allowed");
        finder = _finder;
        require(_getIdentifierWhitelist().isIdentifierSupported(priceIdentifier), "Identifier not registered");
        require(_getAddressWhitelist().isOnWhitelist(_collateralToken), "Unsupported collateral type");

        collateralToken = IERC20Metadata(_collateralToken);
        uint8 decimals_ = IERC20Metadata(_collateralToken).decimals();
        collateralDecimals = decimals_;
        outcomeDecimals = decimals_;
        require(outcomeDecimals == collateralDecimals, "Decimal mismatch");

        customAncillaryData = _customAncillaryData;
        pairName = _pairName;
        proposerReward = _proposerReward;
        optimisticOracleLivenessTime = _optimisticOracleLivenessTime;
        optimisticOracleProposerBond = _optimisticOracleProposerBond;
        requestTimestamp = getCurrentTime();

        longToken = new ExpandedERC20(string(abi.encodePacked(_pairName, " Long Token")), "PLT", decimals_);
        shortToken = new ExpandedERC20(string(abi.encodePacked(_pairName, " Short Token")), "PST", decimals_);
        longToken.addMinter(address(this));
        shortToken.addMinter(address(this));
        longToken.addBurner(address(this));
        shortToken.addBurner(address(this));
    }

    function initializeMarket() external nonReentrant {
        require(!priceRequested, "Already initialized");
        if (proposerReward > 0) _pullExact(msg.sender, proposerReward);
        _requestOraclePrice();
        emit MarketInitialized(requestTimestamp);
    }

    function create(uint256 amount) external requestInitialized nonReentrant {
        require(amount > 0, "Amount is zero");
        _pullExact(msg.sender, amount);
        require(longToken.mint(msg.sender, amount), "Long mint failed");
        require(shortToken.mint(msg.sender, amount), "Short mint failed");
        emit TokensCreated(msg.sender, amount, amount, amount);
    }

    function redeem(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount is zero");
        require(longToken.burnFrom(msg.sender, amount), "Long burn failed");
        require(shortToken.burnFrom(msg.sender, amount), "Short burn failed");
        _pushExact(msg.sender, amount);
        emit TokensRedeemed(msg.sender, amount, amount, amount);
    }

    function settle(uint256 yesAmount, uint256 noAmount) external nonReentrant returns (uint256 collateralReturned) {
        require(receivedSettlementPrice, "Price not yet resolved");
        require(yesAmount > 0 || noAmount > 0, "Amounts are zero");
        require(longToken.burnFrom(msg.sender, yesAmount), "Long burn failed");
        require(shortToken.burnFrom(msg.sender, noAmount), "Short burn failed");

        uint256 yesPayout = Math.mulDiv(yesAmount, settlementPrice, PRICE_SCALE);
        uint256 noPayout = Math.mulDiv(noAmount, PRICE_SCALE - settlementPrice, PRICE_SCALE);
        collateralReturned = yesPayout + noPayout;
        if (collateralReturned > 0) _pushExact(msg.sender, collateralReturned);
        emit PositionSettled(msg.sender, collateralReturned, yesAmount, noAmount, settlementPrice);
    }

    function priceSettled(bytes32 identifier, uint256 timestamp, bytes calldata ancillaryData, int256 price) external {
        require(msg.sender == address(getOptimisticOracle()), "Not authorized");
        require(identifier == priceIdentifier, "Wrong identifier");
        require(keccak256(ancillaryData) == keccak256(customAncillaryData), "Wrong ancillary data");
        if (timestamp != requestTimestamp) return;

        expiryPrice = price;
        if (price >= int256(PRICE_SCALE)) settlementPrice = PRICE_SCALE;
        else if (price == int256(PRICE_SCALE / 2)) settlementPrice = PRICE_SCALE / 2;
        else settlementPrice = 0;
        receivedSettlementPrice = true;
    }

    function priceDisputed(bytes32 identifier, uint256 timestamp, bytes calldata ancillaryData, uint256 refund) external {
        require(msg.sender == address(getOptimisticOracle()), "Not authorized");
        require(timestamp == requestTimestamp, "Wrong timestamp");
        require(identifier == priceIdentifier, "Wrong identifier");
        require(keccak256(ancillaryData) == keccak256(customAncillaryData), "Wrong ancillary data");
        require(refund == proposerReward, "Wrong refund amount");
        uint256 oldTimestamp = requestTimestamp;
        requestTimestamp = getCurrentTime();
        _requestOraclePrice();
        emit PriceDisputed(oldTimestamp, requestTimestamp);
    }

    function getOptimisticOracle() public view returns (OptimisticOracleV2Interface) {
        return OptimisticOracleV2Interface(finder.getImplementationAddress(OracleInterfaces.OptimisticOracleV2));
    }

    function _requestOraclePrice() internal {
        OptimisticOracleV2Interface oracle = getOptimisticOracle();
        IERC20(address(collateralToken)).forceApprove(address(oracle), proposerReward);
        oracle.requestPrice(priceIdentifier, requestTimestamp, customAncillaryData, IERC20(address(collateralToken)), proposerReward);
        oracle.setCustomLiveness(priceIdentifier, requestTimestamp, customAncillaryData, optimisticOracleLivenessTime);
        oracle.setBond(priceIdentifier, requestTimestamp, customAncillaryData, optimisticOracleProposerBond);
        oracle.setEventBased(priceIdentifier, requestTimestamp, customAncillaryData);
        oracle.setCallbacks(priceIdentifier, requestTimestamp, customAncillaryData, false, true, true);
        priceRequested = true;
    }

    function _pullExact(address from, uint256 amount) internal {
        IERC20 token = IERC20(address(collateralToken));
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        require(token.balanceOf(address(this)) - beforeBalance == amount, "Unsupported collateral transfer");
    }

    function _pushExact(address recipient, uint256 amount) internal {
        IERC20 token = IERC20(address(collateralToken));
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        require(senderBefore - token.balanceOf(address(this)) == amount, "Unsupported collateral transfer");
        require(token.balanceOf(recipient) - recipientBefore == amount, "Unsupported collateral transfer");
    }

    function _getIdentifierWhitelist() internal view returns (IdentifierWhitelistInterface) {
        return IdentifierWhitelistInterface(finder.getImplementationAddress(OracleInterfaces.IdentifierWhitelist));
    }

    function _getAddressWhitelist() internal view returns (AddressWhitelist) {
        return AddressWhitelist(finder.getImplementationAddress(OracleInterfaces.CollateralWhitelist));
    }
}
