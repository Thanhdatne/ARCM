// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMarketUmaCallbacks {
    function priceSettled(bytes32 identifier, uint256 timestamp, bytes calldata ancillaryData, int256 price) external;
    function priceDisputed(bytes32 identifier, uint256 timestamp, bytes calldata ancillaryData, uint256 refund) external;
}

contract MockFinder {
    mapping(bytes32 => address) public implementations;

    function changeImplementationAddress(bytes32 interfaceName, address implementationAddress) external {
        implementations[interfaceName] = implementationAddress;
    }

    function getImplementationAddress(bytes32 interfaceName) external view returns (address) {
        return implementations[interfaceName];
    }
}

contract MockIdentifierWhitelist {
    mapping(bytes32 => bool) public supported;

    function addSupportedIdentifier(bytes32 identifier) external { supported[identifier] = true; }
    function removeSupportedIdentifier(bytes32 identifier) external { supported[identifier] = false; }
    function isIdentifierSupported(bytes32 identifier) external view returns (bool) { return supported[identifier]; }
}

contract MockCollateralWhitelist {
    mapping(address => bool) public allowed;

    function addToWhitelist(address collateral) external { allowed[collateral] = true; }
    function removeFromWhitelist(address collateral) external { allowed[collateral] = false; }
    function isOnWhitelist(address collateral) external view returns (bool) { return allowed[collateral]; }
}

contract MockUmaV2 {
    struct RequestData {
        address requester;
        bytes32 identifier;
        uint256 timestamp;
        bytes ancillaryData;
        address currency;
        uint256 reward;
        uint256 bond;
        uint256 liveness;
        bool eventBased;
        bool disputedCallback;
        bool settledCallback;
    }

    mapping(address => RequestData) private requestByRequester;

    function requestPrice(bytes32 identifier, uint256 timestamp, bytes calldata ancillaryData, IERC20 currency, uint256 reward)
        external returns (uint256)
    {
        if (reward > 0) require(currency.transferFrom(msg.sender, address(this), reward), "reward transfer failed");
        requestByRequester[msg.sender] = RequestData(msg.sender, identifier, timestamp, ancillaryData, address(currency), reward, 0, 0, false, false, false);
        return 0;
    }

    function setCustomLiveness(bytes32, uint256, bytes calldata, uint256 liveness) external {
        requestByRequester[msg.sender].liveness = liveness;
    }

    function setBond(bytes32, uint256, bytes calldata, uint256 bond) external returns (uint256) {
        requestByRequester[msg.sender].bond = bond;
        return bond;
    }

    function setEventBased(bytes32, uint256, bytes calldata) external {
        requestByRequester[msg.sender].eventBased = true;
    }

    function setCallbacks(bytes32, uint256, bytes calldata, bool, bool disputed, bool settled) external {
        requestByRequester[msg.sender].disputedCallback = disputed;
        requestByRequester[msg.sender].settledCallback = settled;
    }

    function getRequest(address requester) external view returns (RequestData memory) {
        return requestByRequester[requester];
    }

    function resolve(address requester, int256 price) external {
        RequestData storage request = requestByRequester[requester];
        IMarketUmaCallbacks(requester).priceSettled(request.identifier, request.timestamp, request.ancillaryData, price);
    }

    function dispute(address requester) external {
        RequestData memory request = requestByRequester[requester];
        if (request.reward > 0) IERC20(request.currency).transfer(requester, request.reward);
        IMarketUmaCallbacks(requester).priceDisputed(request.identifier, request.timestamp, request.ancillaryData, request.reward);
    }
}
