// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uma/core/contracts/data-verification-mechanism/interfaces/FinderInterface.sol";

import "./CollateralAllowlist.sol";
import "./EventBasedPredictionMarketV2.sol";
import "./PredictionMarketAMMV2.sol";

contract CreationCodeStore {
    constructor(bytes memory creationCode) {
        require(creationCode.length > 0, "Empty creation code");
        assembly {
            return(add(creationCode, 0x20), mload(creationCode))
        }
    }
}

contract MarketV2Factory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct CreateMarketParams {
        string pairName;
        address collateralToken;
        bytes customAncillaryData;
        uint256 proposerReward;
        uint256 optimisticOracleLivenessTime;
        uint256 optimisticOracleProposerBond;
        uint256 initialLiquidity;
        uint256 feeBps;
    }

    struct MarketPair {
        address market;
        address amm;
        address creator;
        address collateral;
    }

    CollateralAllowlist public immutable collateralAllowlist;
    FinderInterface public immutable finder;
    address public immutable timerAddress;
    address public immutable marketCreationCodeStore;
    address public immutable ammCreationCodeStore;

    MarketPair[] private deployedPairs;
    mapping(address => address) private ammForMarket;
    mapping(address => address) private marketForAmm;

    event MarketCreated(
        uint256 indexed pairId,
        address indexed creator,
        address indexed market,
        address amm,
        address collateral,
        uint8 collateralDecimals,
        uint256 initialLiquidity,
        uint256 feeBps
    );

    constructor(
        address collateralAllowlist_,
        address finder_,
        address timerAddress_,
        address marketCreationCodeStore_,
        address ammCreationCodeStore_
    ) {
        require(collateralAllowlist_ != address(0) && collateralAllowlist_.code.length > 0, "Invalid allowlist");
        require(finder_ != address(0) && finder_.code.length > 0, "Invalid finder");
        require(
            marketCreationCodeStore_ != address(0) && marketCreationCodeStore_.code.length > 0,
            "Invalid market creation code"
        );
        require(
            ammCreationCodeStore_ != address(0) && ammCreationCodeStore_.code.length > 0,
            "Invalid AMM creation code"
        );

        collateralAllowlist = CollateralAllowlist(collateralAllowlist_);
        finder = FinderInterface(finder_);
        timerAddress = timerAddress_;
        marketCreationCodeStore = marketCreationCodeStore_;
        ammCreationCodeStore = ammCreationCodeStore_;
    }

    function createMarket(CreateMarketParams calldata params)
        external nonReentrant returns (address marketAddress, address ammAddress)
    {
        require(params.collateralToken != address(0) && params.collateralToken.code.length > 0, "Invalid collateral");
        require(collateralAllowlist.isCollateralAllowed(params.collateralToken), "Collateral not allowed");
        require(params.initialLiquidity > 0, "Zero liquidity");

        IERC20 collateral = IERC20(params.collateralToken);
        uint256 factoryBalanceBefore = collateral.balanceOf(address(this));
        uint256 collateralRequired = params.proposerReward + params.initialLiquidity;
        collateral.safeTransferFrom(msg.sender, address(this), collateralRequired);
        require(
            collateral.balanceOf(address(this)) - factoryBalanceBefore == collateralRequired,
            "Unsupported collateral transfer"
        );

        marketAddress = _deployMarket(params);

        if (params.proposerReward > 0) collateral.forceApprove(marketAddress, params.proposerReward);
        EventBasedPredictionMarketV2(marketAddress).initializeMarket();
        if (params.proposerReward > 0) collateral.forceApprove(marketAddress, 0);

        ammAddress = _deploy(
            ammCreationCodeStore,
            abi.encode(marketAddress, params.feeBps, address(this)),
            "AMM deployment failed"
        );
        collateral.forceApprove(ammAddress, params.initialLiquidity);
        PredictionMarketAMMV2(ammAddress).initialize(address(this), params.initialLiquidity);
        collateral.forceApprove(ammAddress, 0);

        require(collateral.balanceOf(address(this)) == factoryBalanceBefore, "Collateral residue");
        _validatePair(params, marketAddress, ammAddress);

        _recordPairAndEmit(params, marketAddress, ammAddress, msg.sender);
    }

    function pairCount() external view returns (uint256) {
        return deployedPairs.length;
    }

    function getPair(uint256 pairId) external view returns (MarketPair memory) {
        return deployedPairs[pairId];
    }

    function getAmmForMarket(address market) external view returns (address) {
        return ammForMarket[market];
    }

    function getMarketForAmm(address amm) external view returns (address) {
        return marketForAmm[amm];
    }

    function _deployMarket(CreateMarketParams calldata params) internal returns (address) {
        return _deploy(
            marketCreationCodeStore,
            abi.encode(
                params.pairName,
                params.collateralToken,
                params.customAncillaryData,
                finder,
                timerAddress,
                params.proposerReward,
                params.optimisticOracleLivenessTime,
                params.optimisticOracleProposerBond,
                address(collateralAllowlist)
            ),
            "Market deployment failed"
        );
    }

    function _deploy(address creationCodeStore, bytes memory constructorArgs, string memory errorMessage)
        internal returns (address deployed)
    {
        uint256 creationCodeSize = creationCodeStore.code.length;
        bytes memory creationCode = new bytes(creationCodeSize);
        assembly {
            extcodecopy(creationCodeStore, add(creationCode, 0x20), 0, creationCodeSize)
        }
        bytes memory initCode = bytes.concat(creationCode, constructorArgs);
        assembly {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), errorMessage);
    }

    function _recordPairAndEmit(
        CreateMarketParams calldata params,
        address marketAddress,
        address ammAddress,
        address creator
    ) internal {
        uint256 pairId = deployedPairs.length;
        deployedPairs.push(MarketPair(marketAddress, ammAddress, creator, params.collateralToken));
        ammForMarket[marketAddress] = ammAddress;
        marketForAmm[ammAddress] = marketAddress;

        EventBasedPredictionMarketV2 market = EventBasedPredictionMarketV2(marketAddress);
        emit MarketCreated(
            pairId,
            creator,
            marketAddress,
            ammAddress,
            params.collateralToken,
            market.collateralDecimals(),
            params.initialLiquidity,
            params.feeBps
        );
    }

    function _validatePair(
        CreateMarketParams calldata params,
        address marketAddress,
        address ammAddress
    ) internal view {
        EventBasedPredictionMarketV2 market = EventBasedPredictionMarketV2(marketAddress);
        require(market.contractVersion() == 2, "Invalid market version");
        require(address(market.collateralToken()) == params.collateralToken, "Market collateral mismatch");
        require(address(market.collateralAllowlist()) == address(collateralAllowlist), "Market allowlist mismatch");
        require(address(market.finder()) == address(finder), "Market finder mismatch");

        PredictionMarketAMMV2 amm = PredictionMarketAMMV2(ammAddress);
        require(address(amm.market()) == marketAddress, "AMM market mismatch");
        require(address(amm.collateralToken()) == params.collateralToken, "AMM collateral mismatch");
        require(amm.initializer() == address(this), "AMM initializer mismatch");
        require(amm.initialized(), "AMM not initialized");
        require(amm.reserveYes() == params.initialLiquidity, "YES liquidity mismatch");
        require(amm.reserveNo() == params.initialLiquidity, "NO liquidity mismatch");
    }
}
