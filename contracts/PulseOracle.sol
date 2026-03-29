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
        bytes32 dataHash;        // keccak256 of raw off-chain data — proves AI output integrity
        string  brief;
    }

    address public owner;
    uint256 public snapshotCount;
    uint256 public constant MAX_HISTORY = 50;

    mapping(address => bool) public isWriter;

    Snapshot[50] private _history; // circular buffer
    uint256 public head;

    event SnapshotWritten(uint256 indexed id, uint8 health, uint32 blockHeight);
    event WriterUpdated(address indexed writer, bool allowed);

    modifier onlyOwner() {
        require(msg.sender == owner, "PulseOracle: not owner");
        _;
    }

    modifier onlyWriter() {
        require(msg.sender == owner || isWriter[msg.sender], "PulseOracle: not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setWriter(address writer, bool allowed) external onlyOwner {
        require(writer != address(0), "PulseOracle: zero address");
        isWriter[writer] = allowed;
        emit WriterUpdated(writer, allowed);
    }

    function writeSnapshot(
        uint32 _blockHeight,
        uint32 _activeMinitilas,
        uint32 _ibcChannels,
        uint32 _totalValidators,
        uint32 _activeProposals,
        uint64 _totalTxCount,
        uint8  _ecosystemHealth,
        bytes32 _dataHash,
        string calldata _brief
    ) external onlyWriter {
        _history[head] = Snapshot({
            timestamp: block.timestamp,
            blockHeight: _blockHeight,
            activeMinitilas: _activeMinitilas,
            ibcChannels: _ibcChannels,
            totalValidators: _totalValidators,
            activeProposals: _activeProposals,
            totalTxCount: _totalTxCount,
            ecosystemHealth: _ecosystemHealth,
            dataHash: _dataHash,
            brief: _brief
        });

        head = (head + 1) % MAX_HISTORY;
        snapshotCount++;

        emit SnapshotWritten(snapshotCount, _ecosystemHealth, _blockHeight);
    }

    /// @notice Returns the most recent snapshot
    function latest() external view returns (Snapshot memory) {
        require(snapshotCount > 0, "PulseOracle: no snapshots");
        uint256 idx = (head + MAX_HISTORY - 1) % MAX_HISTORY;
        return _history[idx];
    }

    /// @notice Returns a specific snapshot by buffer index (0..MAX_HISTORY-1)
    function getSnapshot(uint256 index) external view returns (Snapshot memory) {
        require(index < MAX_HISTORY, "PulseOracle: index out of range");
        return _history[index];
    }

    /// @notice Returns all stored snapshots (circular buffer, up to 50)
    function getHistory() external view returns (Snapshot[50] memory) {
        return _history;
    }

    /// @notice Count consecutive recent snapshots with health >= minHealth
    ///         Useful for DeFi risk scoring (e.g. "has health been >= 2 for 10 snapshots?")
    function healthStreak(uint8 minHealth) external view returns (uint256 streak) {
        if (snapshotCount == 0) return 0;
        uint256 count = snapshotCount < MAX_HISTORY ? snapshotCount : MAX_HISTORY;
        for (uint256 i = 0; i < count; i++) {
            uint256 idx = (head + MAX_HISTORY - 1 - i) % MAX_HISTORY;
            if (_history[idx].ecosystemHealth >= minHealth) {
                streak++;
            } else {
                break;
            }
        }
    }

    /// @notice Composable health gate — use in DeFi to require ecosystem stability
    ///         e.g. require(oracle.isHealthy(2, 10), "ecosystem unstable")
    function isHealthy(uint8 minHealth, uint256 minStreak) external view returns (bool) {
        if (snapshotCount == 0) return false;
        uint256 count = snapshotCount < MAX_HISTORY ? snapshotCount : MAX_HISTORY;
        if (minStreak > count) return false;
        for (uint256 i = 0; i < minStreak; i++) {
            uint256 idx = (head + MAX_HISTORY - 1 - i) % MAX_HISTORY;
            if (_history[idx].ecosystemHealth < minHealth) return false;
        }
        return true;
    }

    /// @notice Human-readable health label for the latest snapshot
    function healthLabel() external view returns (string memory) {
        if (snapshotCount == 0) return "unknown";
        uint256 idx = (head + MAX_HISTORY - 1) % MAX_HISTORY;
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
