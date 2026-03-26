// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PulseGov
 * @notice Allows any EVM wallet on initia-pulse-1 to vote on Initia L1 governance
 *         proposals by executing a real Cosmos MsgVote via the ICosmos precompile.
 *
 *         Flow: user calls vote() on initia-pulse-1 (EVM tx)
 *               → execute_cosmos(MsgVote) is recorded
 *               → after EVM execution, Cosmos runtime posts the MsgVote to interwoven-1
 *               → the vote appears on the L1 governance module
 *
 * @dev Deployed on initia-pulse-1 (our EVM rollup, chain EVM ID 2150269405855764)
 *      ICosmos precompile: 0x00000000000000000000000000000000000000f1
 */

interface ICosmos {
    function to_cosmos_address(address evm_address) external returns (string memory cosmos_address);
    function execute_cosmos(string memory msg) external returns (bool dummy);
}

contract PulseGov {
    ICosmos constant COSMOS = ICosmos(0x00000000000000000000000000000000000000f1);

    // ─── Vote options (mirrors cosmos.gov.v1.VoteOption) ──────────────────────
    uint8 public constant VOTE_YES     = 1;
    uint8 public constant VOTE_ABSTAIN = 2;
    uint8 public constant VOTE_NO      = 3;
    uint8 public constant VOTE_VETO    = 4;

    event VoteCast(
        address indexed voter,
        string cosmosAddress,
        uint64 proposalId,
        string option
    );

    // ─── Core action ──────────────────────────────────────────────────────────
    /**
     * @notice Vote on an Initia L1 governance proposal from this EVM rollup.
     * @param proposalId  The L1 governance proposal ID (e.g. 42)
     * @param option      Vote option: 1=YES, 2=ABSTAIN, 3=NO, 4=VETO
     */
    function vote(uint64 proposalId, uint8 option) external {
        require(option >= 1 && option <= 4, "Invalid vote option");

        string memory voteOption = _optionString(option);
        string memory voterCosmos = COSMOS.to_cosmos_address(msg.sender);

        // Build cosmos.gov.v1.MsgVote JSON
        string memory cosmosMsg = string.concat(
            '{"@type":"/cosmos.gov.v1.MsgVote","proposal_id":"',
            _uint64ToString(proposalId),
            '","voter":"',
            voterCosmos,
            '","option":"',
            voteOption,
            '","metadata":""}'
        );

        COSMOS.execute_cosmos(cosmosMsg);
        emit VoteCast(msg.sender, voterCosmos, proposalId, voteOption);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function _optionString(uint8 option) internal pure returns (string memory) {
        if (option == VOTE_YES)     return "VOTE_OPTION_YES";
        if (option == VOTE_ABSTAIN) return "VOTE_OPTION_ABSTAIN";
        if (option == VOTE_NO)      return "VOTE_OPTION_NO";
        return "VOTE_OPTION_NO_WITH_VETO";
    }

    function _uint64ToString(uint64 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint64 tmp = n;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (n != 0) { buffer[--digits] = bytes1(uint8(48 + (n % 10))); n /= 10; }
        return string(buffer);
    }
}
