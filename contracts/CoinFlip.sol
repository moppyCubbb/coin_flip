// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract CoinFlip {
    address payable banker;
    address payable[2] players;

    uint256 round;

    bytes32[2] hashes;
    uint256[2] values;
    uint256[2] deposits;

    event GameResult (
        address winner,
        uint256 player1_value,
        uint256 player2_value,
        uint256 total_deposit
    );

    constructor() {
        banker = payable(address(0x631a5FBde01BF64b073985f7C1B55BAcE6Cb9094));
    }

    function get_round() public view returns (uint256) {
        return round;
    }
    function get_players() public view returns (address, address) {
        return (players[0], players[1]);
    }
    function get_values() public view returns (uint256, uint256) {
        return (values[0], values[1]);
    }

    function init_game() public {
        round = 0;
        players[0] = payable(address(0));
        players[1] = payable(address(0));
    }

    function set_hash(bytes32 hash) public payable {
        require(msg.sender != banker, "Banker cannot join the game.");
        require(round == 0 || round == 1, "Error in game process.");

        if (round == 1) {
            require(payable(msg.sender) != players[0], "Cannot play with yourself.");
        }

        if (round == 0 || round == 1) {
            players[round] = payable(msg.sender);
            hashes[round] = bytes32(hash);
            deposits[round] = msg.value;
        } else {
            revert();
        }
        round++;
    }

    function reveal(uint256 value) public {
        if (msg.sender == players[0]) {
            require(round == 3, "Error in game process.");
            require(hashes[0] == sha256(abi.encodePacked(value)), "The hash of reveal value does not match the committed one.");
            
            values[0] = value;
        } else if (msg.sender == players[1]) {
            require(round == 2, "Error in game process.");
            require(hashes[1] == sha256(abi.encodePacked(value)), "The hash of reveal value does not match the committed one.");
            
            values[1] = value;
        } else {
            revert();
        }

        round++;
    }

    function confirm() public {
        require(round == 4, "Error in game process.");

        address winner = address(0);
        if (values[0] % 2 == values[1] % 2) {
            players[0].transfer(((deposits[0] + deposits[1]) * 19) / 20);
            winner = players[0];
        } else {
            players[1].transfer(((deposits[0] + deposits[1]) * 19) / 20);
            winner = players[1];
        }

        banker.transfer((deposits[0] + deposits[1]) / 20);

        round++;
        emit GameResult(winner, values[0], values[1], ((deposits[0] + deposits[1]) * 19) / 20);
    }
}