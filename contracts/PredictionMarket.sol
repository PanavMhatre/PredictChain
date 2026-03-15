// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PredictionMarket {
    address public owner;

    struct Market {
        string question;
        string[] options;
        uint256 deadline;
        bool resolved;
        uint8 winningOption;
        uint256 totalPool;
        bool exists;
    }

    uint256 public marketCount;

    mapping(uint256 => Market) public markets;

    // marketId => optionIndex => userAddress => stakeAmount
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public stakes;

    // marketId => optionIndex => totalStaked on that option
    mapping(uint256 => mapping(uint8 => uint256)) public optionTotals;

    // marketId => userAddress => whether they claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, string question, string[] options, uint256 deadline);
    event Voted(uint256 indexed marketId, uint8 optionIndex, address indexed voter, uint256 amount);
    event MarketResolved(uint256 indexed marketId, uint8 winningOption);
    event RewardClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier marketExists(uint256 marketId) {
        require(markets[marketId].exists, "Market does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createMarket(
        string calldata question,
        string[] calldata options,
        uint256 deadline
    ) external onlyOwner returns (uint256) {
        require(options.length >= 2 && options.length <= 10, "Need 2-10 options");
        require(deadline > block.timestamp, "Deadline must be in the future");

        uint256 marketId = marketCount++;
        Market storage m = markets[marketId];
        m.question = question;
        m.deadline = deadline;
        m.resolved = false;
        m.totalPool = 0;
        m.exists = true;

        for (uint256 i = 0; i < options.length; i++) {
            m.options.push(options[i]);
        }

        emit MarketCreated(marketId, question, options, deadline);
        return marketId;
    }

    function vote(uint256 marketId, uint8 optionIndex) external payable marketExists(marketId) {
        Market storage m = markets[marketId];
        require(!m.resolved, "Market already resolved");
        require(block.timestamp < m.deadline, "Market voting has ended");
        require(optionIndex < m.options.length, "Invalid option");
        require(msg.value > 0, "Must stake some ETH");

        stakes[marketId][optionIndex][msg.sender] += msg.value;
        optionTotals[marketId][optionIndex] += msg.value;
        m.totalPool += msg.value;

        emit Voted(marketId, optionIndex, msg.sender, msg.value);
    }

    function resolveMarket(uint256 marketId, uint8 winningOption) external onlyOwner marketExists(marketId) {
        Market storage m = markets[marketId];
        require(!m.resolved, "Already resolved");
        require(winningOption < m.options.length, "Invalid winning option");

        m.resolved = true;
        m.winningOption = winningOption;

        emit MarketResolved(marketId, winningOption);
    }

    function claimReward(uint256 marketId) external marketExists(marketId) {
        Market storage m = markets[marketId];
        require(m.resolved, "Market not resolved yet");
        require(!claimed[marketId][msg.sender], "Already claimed");

        uint8 winner = m.winningOption;
        uint256 userStake = stakes[marketId][winner][msg.sender];
        require(userStake > 0, "No winning stake");

        claimed[marketId][msg.sender] = true;

        uint256 winnerPool = optionTotals[marketId][winner];
        uint256 reward = (m.totalPool * userStake) / winnerPool;

        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");

        emit RewardClaimed(marketId, msg.sender, reward);
    }

    function getMarket(uint256 marketId) external view marketExists(marketId) returns (
        string memory question,
        string[] memory options,
        uint256 deadline,
        bool resolved,
        uint8 winningOption,
        uint256 totalPool
    ) {
        Market storage m = markets[marketId];
        return (m.question, m.options, m.deadline, m.resolved, m.winningOption, m.totalPool);
    }

    function getOptionTotal(uint256 marketId, uint8 optionIndex) external view returns (uint256) {
        return optionTotals[marketId][optionIndex];
    }

    function getUserStake(uint256 marketId, uint8 optionIndex, address user) external view returns (uint256) {
        return stakes[marketId][optionIndex][user];
    }

    function hasUserClaimed(uint256 marketId, address user) external view returns (bool) {
        return claimed[marketId][user];
    }
}
