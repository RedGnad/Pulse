// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PulseOracle
 * @notice On-chain ecosystem intelligence for the Interwoven Network.
 *         Stores periodic AI-generated snapshots of the Initia ecosystem.
 *         Any contract can call latest() or getHistory() to read the state.
 */
contract PulseOracle {
    struct Snapshot {
        uint256 timestamp;
        uint32  blockHeight;
        uint32  activeMinitilas;
        uint32  ibcChannels;
        uint32  totalValidators;
        uint32  activeProposals;
        uint64  totalTxCount;
        uint8   ecosystemHealth; // 3=thriving, 2=growing, 1=critical, 0=unknown
        string  brief;
    }

    address public owner;
    uint256 public snapshotCount;
    uint256 constant MAX_HISTORY = 10;

    Snapshot[10] private _history; // circular buffer
    uint256 private _head;

    event SnapshotWritten(uint256 indexed id, uint8 health, uint32 blockHeight);

    modifier onlyOwner() {
        require(msg.sender == owner, "PulseOracle: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function writeSnapshot(
        uint32 _blockHeight,
        uint32 _activeMinitilas,
        uint32 _ibcChannels,
        uint32 _totalValidators,
        uint32 _activeProposals,
        uint64 _totalTxCount,
        uint8  _ecosystemHealth,
        string calldata _brief
    ) external onlyOwner {
        _history[_head] = Snapshot({
            timestamp: block.timestamp,
            blockHeight: _blockHeight,
            activeMinitilas: _activeMinitilas,
            ibcChannels: _ibcChannels,
            totalValidators: _totalValidators,
            activeProposals: _activeProposals,
            totalTxCount: _totalTxCount,
            ecosystemHealth: _ecosystemHealth,
            brief: _brief
        });

        _head = (_head + 1) % MAX_HISTORY;
        snapshotCount++;

        emit SnapshotWritten(snapshotCount, _ecosystemHealth, _blockHeight);
    }

    /// @notice Returns the most recent snapshot
    function latest() external view returns (Snapshot memory) {
        require(snapshotCount > 0, "PulseOracle: no snapshots");
        uint256 idx = (_head + MAX_HISTORY - 1) % MAX_HISTORY;
        return _history[idx];
    }

    /// @notice Returns all stored snapshots (up to 10)
    function getHistory() external view returns (Snapshot[10] memory) {
        return _history;
    }

    /// @notice Human-readable health label for the latest snapshot
    function healthLabel() external view returns (string memory) {
        if (snapshotCount == 0) return "unknown";
        uint256 idx = (_head + MAX_HISTORY - 1) % MAX_HISTORY;
        uint8 h = _history[idx].ecosystemHealth;
        if (h == 3) return "thriving";
        if (h == 2) return "growing";
        if (h == 1) return "critical";
        return "unknown";
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "PulseOracle: zero address");
        owner = newOwner;
    }
}
