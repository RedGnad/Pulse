// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPulseOracle {
    function isHealthy(uint8 minHealth, uint256 minStreak) external view returns (bool);
}

/// @title PulseGate — Demo consumer of PulseOracle composable primitives
/// @notice Shows how any DeFi protocol can gate operations on ecosystem health
contract PulseGate {
    IPulseOracle public oracle;

    event ActionExecuted(address indexed user, string action, uint256 timestamp);
    event ActionBlocked(address indexed user, string reason);

    constructor(address _oracle) {
        oracle = IPulseOracle(_oracle);
    }

    /// @notice Example: only allow deposits when ecosystem is healthy
    function gatedDeposit() external {
        require(
            oracle.isHealthy(2, 3), // health >= "growing" for last 3 snapshots
            "PulseGate: ecosystem health too low"
        );
        emit ActionExecuted(msg.sender, "deposit", block.timestamp);
    }

    /// @notice Example: emergency mode check
    function isEmergencyMode() external view returns (bool) {
        return !oracle.isHealthy(1, 1); // not even "critical" for 1 snapshot = emergency
    }
}
