// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IEventBasedPredictionMarketV2.sol";

contract PredictionMarketAMMV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;
    uint256 private constant MAX_RESERVE = type(uint128).max;

    IEventBasedPredictionMarketV2 public immutable market;
    IERC20 public immutable collateralToken;
    IERC20 public immutable longToken;
    IERC20 public immutable shortToken;
    address public immutable initializer;
    uint8 public immutable collateralDecimals;
    uint8 public immutable outcomeDecimals;
    uint256 public immutable feeBps;

    uint256 public reserveYes;
    uint256 public reserveNo;
    bool public initialized;

    event Initialized(address indexed initializer, address indexed provider, uint256 liquidity);
    event BuyYes(address indexed trader, uint256 collateralIn, uint256 yesOut, uint256 minOut, uint256 fee);
    event BuyNo(address indexed trader, uint256 collateralIn, uint256 noOut, uint256 minOut, uint256 fee);
    event SellYes(address indexed trader, uint256 yesIn, uint256 collateralOut, uint256 minOut, uint256 fee);
    event SellNo(address indexed trader, uint256 noIn, uint256 collateralOut, uint256 minOut, uint256 fee);

    constructor(address marketAddress, uint256 feeBps_, address initializer_) {
        require(marketAddress != address(0) && marketAddress.code.length > 0, "Invalid market");
        require(initializer_ != address(0), "Invalid initializer");
        require(feeBps_ < BPS_DENOMINATOR, "Fee too high");

        IEventBasedPredictionMarketV2 market_ = IEventBasedPredictionMarketV2(marketAddress);
        require(market_.contractVersion() == 2, "Invalid market version");

        address collateralAddress = market_.collateralToken();
        address longAddress = market_.longToken();
        address shortAddress = market_.shortToken();
        require(
            collateralAddress != address(0) && collateralAddress.code.length > 0 &&
            longAddress != address(0) && longAddress.code.length > 0 &&
            shortAddress != address(0) && shortAddress.code.length > 0 &&
            collateralAddress != longAddress && collateralAddress != shortAddress && longAddress != shortAddress,
            "Invalid token addresses"
        );

        uint8 collateralDecimals_ = market_.collateralDecimals();
        uint8 outcomeDecimals_ = market_.outcomeDecimals();
        require(outcomeDecimals_ == collateralDecimals_, "Decimal mismatch");
        require(IERC20Metadata(collateralAddress).decimals() == collateralDecimals_, "Collateral decimals mismatch");
        require(IERC20Metadata(longAddress).decimals() == outcomeDecimals_, "Long decimals mismatch");
        require(IERC20Metadata(shortAddress).decimals() == outcomeDecimals_, "Short decimals mismatch");

        market = market_;
        collateralToken = IERC20(collateralAddress);
        longToken = IERC20(longAddress);
        shortToken = IERC20(shortAddress);
        initializer = initializer_;
        collateralDecimals = collateralDecimals_;
        outcomeDecimals = outcomeDecimals_;
        feeBps = feeBps_;
    }

    modifier whenActive(uint256 deadline) {
        require(initialized, "Not initialized");
        require(!market.receivedSettlementPrice(), "Market resolved");
        require(block.timestamp <= deadline, "Deadline expired");
        _;
    }

    function initialize(address provider, uint256 initialLiquidity) external nonReentrant {
        require(msg.sender == initializer, "Not initializer");
        require(!initialized, "Already initialized");
        require(provider != address(0), "Invalid provider");
        require(initialLiquidity > 0, "Zero liquidity");
        require(initialLiquidity <= MAX_RESERVE, "Reserve overflow");

        initialized = true;
        _pullExact(collateralToken, provider, initialLiquidity, "Unsupported collateral transfer");
        collateralToken.forceApprove(address(market), initialLiquidity);
        market.create(initialLiquidity);
        collateralToken.forceApprove(address(market), 0);
        longToken.forceApprove(address(market), type(uint256).max);
        shortToken.forceApprove(address(market), type(uint256).max);

        reserveYes = initialLiquidity;
        reserveNo = initialLiquidity;
        _assertReserves();
        emit Initialized(msg.sender, provider, initialLiquidity);
    }

    function buyYes(uint256 collateralIn, uint256 minOut, uint256 deadline)
        external nonReentrant whenActive(deadline) returns (uint256 yesOut)
    {
        _requireInput(collateralIn);
        uint256 fee;
        (yesOut, fee) = _quoteBuy(collateralIn, reserveNo, reserveYes);
        _requireOutput(yesOut, minOut);
        require(reserveNo + collateralIn <= MAX_RESERVE, "Reserve overflow");

        _pullExact(collateralToken, msg.sender, collateralIn, "Unsupported collateral transfer");
        collateralToken.forceApprove(address(market), collateralIn);
        market.create(collateralIn);
        collateralToken.forceApprove(address(market), 0);

        uint256 swapOut = yesOut - collateralIn;
        reserveYes -= swapOut;
        reserveNo += collateralIn;
        _pushExact(longToken, msg.sender, yesOut, "Unsupported outcome transfer");
        _assertReserves();
        emit BuyYes(msg.sender, collateralIn, yesOut, minOut, fee);
    }

    function buyNo(uint256 collateralIn, uint256 minOut, uint256 deadline)
        external nonReentrant whenActive(deadline) returns (uint256 noOut)
    {
        _requireInput(collateralIn);
        uint256 fee;
        (noOut, fee) = _quoteBuy(collateralIn, reserveYes, reserveNo);
        _requireOutput(noOut, minOut);
        require(reserveYes + collateralIn <= MAX_RESERVE, "Reserve overflow");

        _pullExact(collateralToken, msg.sender, collateralIn, "Unsupported collateral transfer");
        collateralToken.forceApprove(address(market), collateralIn);
        market.create(collateralIn);
        collateralToken.forceApprove(address(market), 0);

        uint256 swapOut = noOut - collateralIn;
        reserveNo -= swapOut;
        reserveYes += collateralIn;
        _pushExact(shortToken, msg.sender, noOut, "Unsupported outcome transfer");
        _assertReserves();
        emit BuyNo(msg.sender, collateralIn, noOut, minOut, fee);
    }

    function sellYes(uint256 yesIn, uint256 minOut, uint256 deadline)
        external nonReentrant whenActive(deadline) returns (uint256 collateralOut)
    {
        _requireInput(yesIn);
        uint256 fee;
        (collateralOut, fee) = _quoteSell(yesIn, reserveYes, reserveNo);
        _requireOutput(collateralOut, minOut);
        require(reserveYes + yesIn - collateralOut <= MAX_RESERVE, "Reserve overflow");

        _pullExact(longToken, msg.sender, yesIn, "Unsupported outcome transfer");
        reserveYes = reserveYes + yesIn - collateralOut;
        reserveNo -= collateralOut;
        market.redeem(collateralOut);
        _pushExact(collateralToken, msg.sender, collateralOut, "Unsupported collateral transfer");
        _assertReserves();
        emit SellYes(msg.sender, yesIn, collateralOut, minOut, fee);
    }

    function sellNo(uint256 noIn, uint256 minOut, uint256 deadline)
        external nonReentrant whenActive(deadline) returns (uint256 collateralOut)
    {
        _requireInput(noIn);
        uint256 fee;
        (collateralOut, fee) = _quoteSell(noIn, reserveNo, reserveYes);
        _requireOutput(collateralOut, minOut);
        require(reserveNo + noIn - collateralOut <= MAX_RESERVE, "Reserve overflow");

        _pullExact(shortToken, msg.sender, noIn, "Unsupported outcome transfer");
        reserveNo = reserveNo + noIn - collateralOut;
        reserveYes -= collateralOut;
        market.redeem(collateralOut);
        _pushExact(collateralToken, msg.sender, collateralOut, "Unsupported collateral transfer");
        _assertReserves();
        emit SellNo(msg.sender, noIn, collateralOut, minOut, fee);
    }

    function calcBuyYes(uint256 collateralIn) external view returns (uint256) {
        (uint256 output,) = _quoteBuy(collateralIn, reserveNo, reserveYes);
        return output;
    }

    function calcBuyNo(uint256 collateralIn) external view returns (uint256) {
        (uint256 output,) = _quoteBuy(collateralIn, reserveYes, reserveNo);
        return output;
    }

    function calcSellYes(uint256 yesIn) external view returns (uint256) {
        (uint256 output,) = _quoteSell(yesIn, reserveYes, reserveNo);
        return output;
    }

    function calcSellNo(uint256 noIn) external view returns (uint256) {
        (uint256 output,) = _quoteSell(noIn, reserveNo, reserveYes);
        return output;
    }

    function getYesPrice() external view returns (uint256) {
        uint256 total = reserveYes + reserveNo;
        return total == 0 ? PRICE_SCALE / 2 : Math.mulDiv(reserveNo, PRICE_SCALE, total);
    }

    function getNoPrice() external view returns (uint256) {
        uint256 total = reserveYes + reserveNo;
        return total == 0 ? PRICE_SCALE / 2 : Math.mulDiv(reserveYes, PRICE_SCALE, total);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserveYes, reserveNo);
    }

    function _quoteBuy(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal view returns (uint256 output, uint256 fee)
    {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return (0, 0);
        require(amountIn <= MAX_RESERVE, "Input too large");
        uint256 effective = Math.mulDiv(amountIn, BPS_DENOMINATOR - feeBps, BPS_DENOMINATOR);
        fee = amountIn - effective;
        uint256 swapOut = Math.mulDiv(reserveOut, effective, reserveIn + effective);
        output = amountIn + swapOut;
    }

    function _quoteSell(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal view returns (uint256 output, uint256 fee)
    {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return (0, 0);
        require(amountIn <= MAX_RESERVE, "Input too large");
        uint256 effective = Math.mulDiv(amountIn, BPS_DENOMINATOR - feeBps, BPS_DENOMINATOR);
        fee = amountIn - effective;
        if (effective == 0) return (0, fee);
        require(reserveIn + effective <= MAX_RESERVE, "Reserve overflow");

        uint256 low;
        uint256 high = Math.min(effective, reserveOut);
        uint256 invariant = reserveIn * reserveOut;
        while (low < high) {
            uint256 mid = low + (high - low + 1) / 2;
            if ((reserveIn + effective - mid) * (reserveOut - mid) >= invariant) low = mid;
            else high = mid - 1;
        }
        output = low;
    }

    function _requireInput(uint256 amount) internal pure {
        require(amount > 0, "Zero amount");
    }

    function _requireOutput(uint256 output, uint256 minOut) internal pure {
        require(output > 0, "Zero output");
        require(output >= minOut, "Slippage exceeded");
    }

    function _pullExact(IERC20 token, address from, uint256 amount, string memory errorMessage) internal {
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        require(token.balanceOf(address(this)) - beforeBalance == amount, errorMessage);
    }

    function _pushExact(IERC20 token, address recipient, uint256 amount, string memory errorMessage) internal {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        require(senderBefore - token.balanceOf(address(this)) == amount, errorMessage);
        require(token.balanceOf(recipient) - recipientBefore == amount, errorMessage);
    }

    function _assertReserves() internal view {
        require(longToken.balanceOf(address(this)) == reserveYes, "YES reserve mismatch");
        require(shortToken.balanceOf(address(this)) == reserveNo, "NO reserve mismatch");
    }
}
