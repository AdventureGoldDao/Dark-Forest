// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

//Type imports
import {Player, Union, MemberLog} from "../DFTypes.sol";
import {DFWhitelistFacet} from "./DFWhitelistFacet.sol";

contract DFUnionFacet is WithStorage {
    event UnionCreated(uint256 indexed unionId, address indexed creator);
    event InviteSent(uint256 indexed unionId, address indexed invitee);
    event InviteCanceled(uint256 indexed unionId, address indexed invitee);
    event InviteAccepted(uint256 indexed unionId, address indexed invitee);
    event ApplicationSent(uint256 indexed unionId, address indexed applicant);
    event ApplicationCanceled(uint256 indexed unionId, address indexed applicant);
    event ApplicationAccepted(uint256 indexed unionId, address indexed applicant);
    event ApplicationRejected(uint256 indexed unionId, address indexed applicant);
    event MemberLeft(uint256 indexed unionId, address indexed member);
    event MemberKicked(uint256 indexed unionId, address indexed member);
    event UnionTransferred(
        uint256 indexed unionId,
        address indexed oldAdmin,
        address indexed newAdmin
    );
    event UnionNameChanged(uint256 indexed unionId, string newName);
    event UnionDisbanded(uint256 indexed unionId, address[] members);
    event UnionLeveledUp(uint256 indexed unionId, uint256 newLevel);
    event MemberAddedByAdmin(uint256 indexed unionId, address member);

    modifier onlyAdmin() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier validUnion(uint256 _unionId) {
        require(gs().unions[_unionId].unionId != 0, "valid union");
        _;
    }

    modifier onlyAdminOrUnionLeader(uint256 _unionId) {
        require(
            LibDiamond.contractOwner() == msg.sender || gs().unions[_unionId].leader == msg.sender,
            "Only admin or  union leader"
        );
        _;
    }

    modifier onlyUnionLeader(uint256 _unionId) {
        require(gs().unions[_unionId].leader == msg.sender, "Only union leader");
        _;
    }

    modifier onlyUnionMember(uint256 _unionId) {
        require(isMember(_unionId, msg.sender), "Only union member");
        _;
    }

    modifier onlyWhitelisted() {
        require(
            DFWhitelistFacet(address(this)).isWhitelisted(msg.sender) ||
                msg.sender == LibDiamond.contractOwner(),
            "Player is not whitelisted"
        );
        _;
    }

    modifier notPaused() {
        require(!gs().paused, "Game is paused");
        _;
    }

    // utils & getter functions

    function _bulkGetStructs(
        uint256[] storage keys,
        mapping(uint256 => Union) storage data,
        uint256 startIdx,
        uint256 endIdx
    ) internal view returns (Union[] memory ret) {
        ret = new Union[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = data[keys[i]];
        }
    }

    function isMember(uint256 _unionId, address _user) public view returns (bool) {
        return gs().isMember[_unionId][_user];
    }

    function isInvitee(uint256 _unionId, address _user) public view returns (bool) {
        return gs().isInvitee[_unionId][_user];
    }

    function isApplicant(uint256 _unionId, address _user) public view returns (bool) {
        return gs().isApplicant[_unionId][_user];
    }

    function getMaxMembers(uint256 _level) public pure returns (uint256) {
        uint256 MEMBERS_PER_LEVEL = 2;
        uint256 BASE_MAX_MEMBERS = 5;
        return BASE_MAX_MEMBERS + _level * MEMBERS_PER_LEVEL;
    }

    function getUnionCreationFee() public view returns (uint256) {
        return gs().unionCreationFee;
    }

    function getUnionUpgradeFeePreMember() public view returns (uint256) {
        return gs().unionUpgradeFeePerMember;
    }

    function getUnionRejoinCooldown() public view returns (uint256) {
        return gs().unionRejoinCooldown;
    }

    function getAllUnions() public view returns (uint256[] memory) {
        return gs().unionIds;
    }

    function getNUnions() public view returns (uint256) {
        return gs().unionIds.length;
    }

    function unions(uint256 key) public view returns (Union memory) {
        return gs().unions[key];
    }

    function bulkGetUnionIds(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        ret = new uint256[](endIdx = startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = gs().unionIds[i];
        }
    }

    function bulkGetUnions(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (Union[] memory ret)
    {
        return _bulkGetStructs(gs().unionIds, gs().unions, startIdx, endIdx);
    }

    function removeAddressFromList(address[] storage list, address aim) internal {
        uint256 length = list.length;
        for (uint256 i = 0; i < length; i++) {
            if (list[i] == aim) {
                list[i] = list[length - 1];
                list.pop();
                break;
            }
        }
    }

    // game admin operations

    // Round 4 Todo: add more admin operations
    function adminSetUnionCreationFee(uint256 fee) public onlyAdmin {
        gs().unionCreationFee = fee;
    }

    function adminSetUnionUpgradeFeePreMember(uint256 fee) public onlyAdmin {
        gs().unionUpgradeFeePerMember = fee;
    }

    function adminSetUnionRejoinCooldown(uint256 cooldown) public onlyAdmin {
        gs().unionRejoinCooldown = cooldown;
    }

    // Administrator adds a member directly without invitation
    function addMemberByAdmin(uint256 _unionId, address _member)
        public
        onlyAdmin
        validUnion(_unionId)
    {
        require(_member != address(0), "Invalid member address");
        require(gs().players[_member].isInitialized, "Only initialized player");
        require(!isMember(_unionId, _member), "Not in this union");
        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        require(union.members.length < getMaxMembers(union.level), "Union is full");

        union.members.push(_member);
        gs().isMember[_unionId][_member] = true;
        gs().players[_member].unionId = _unionId;
        gs().isInvitee[_unionId][_member] = false;
        removeAddressFromList(union.invitees, _member);
        gs().isApplicant[_unionId][_member] = false;
        removeAddressFromList(union.applicants, _member);

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: false, timestamp: uint64(block.timestamp), member: _member})
        );

        emit MemberAddedByAdmin(_unionId, _member);
    }

    // players operations

    function createUnion(string memory name) public payable notPaused onlyWhitelisted {
        require(gs().players[msg.sender].isInitialized, "Only initialized player");
        require(gs().players[msg.sender].unionId == 0, "Already part of a union");
        require(msg.value == gs().unionCreationFee, "Incorrect creation fee");

        gs().unionCount++;
        gs().unionIds.push(gs().unionCount);
        Union storage union = gs().unions[gs().unionCount];
        union.unionId = gs().unionCount;
        union.name = name;
        union.leader = msg.sender;
        union.level = 0;
        union.members.push(msg.sender);
        gs().isMember[gs().unionCount][msg.sender] = true;
        gs().players[msg.sender].unionId = gs().unionCount;

        // update union log
        ls().unionLog[union.unionId].createdAt = block.timestamp;
        ls().unionLog[union.unionId].memberLogs.push(
            MemberLog({left: false, timestamp: uint64(block.timestamp), member: msg.sender})
        );

        emit UnionCreated(gs().unionCount, msg.sender);
    }

    function inviteMember(uint256 _unionId, address _invitee)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        require(_invitee != address(0), "Invalid invitee address");
        require(gs().players[_invitee].isInitialized, "Only initialized player");
        require(gs().players[_invitee].unionId == 0, "Invitee already part of a union");
        require(!isMember(_unionId, _invitee), "Invitee is already a member");
        require(!isInvitee(_unionId, _invitee), "Invitee is already in invitee list");
        require(!isApplicant(_unionId, _invitee), "invitee is already in applicant list");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        union.invitees.push(_invitee);
        gs().isInvitee[_unionId][_invitee] = true;

        emit InviteSent(_unionId, _invitee);
    }

    function cancelInvite(uint256 _unionId, address _invitee)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        require(_invitee != address(0), "Invalid invitee address");
        require(gs().players[_invitee].isInitialized, "Only initialized player");
        require(isInvitee(_unionId, _invitee), "No invition");
        require(!isMember(_unionId, _invitee), "Not member");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        gs().isInvitee[_unionId][_invitee] = false;
        removeAddressFromList(union.invitees, _invitee);

        emit InviteCanceled(_unionId, _invitee);
    }

    function acceptInvite(uint256 _unionId) public notPaused validUnion(_unionId) onlyWhitelisted {
        require(gs().players[msg.sender].unionId == 0, "Already part of a union");
        require(isInvitee(_unionId, msg.sender), "Not inivited");
        require(!isMember((_unionId), msg.sender), "Already in this union");
        require(
            gs().players[msg.sender].leaveUnionTimestamp + gs().unionRejoinCooldown <=
                block.timestamp,
            "in rejoin cooldown time"
        );

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        require(union.members.length < getMaxMembers(union.level), "Union is full");

        gs().players[msg.sender].unionId = _unionId;
        union.members.push(msg.sender);
        gs().isMember[_unionId][msg.sender] = true;
        gs().isInvitee[_unionId][msg.sender] = false; // Clear the invitation
        removeAddressFromList(union.invitees, msg.sender); // Update invite records
        gs().isApplicant[_unionId][msg.sender] = false; // clear the application
        removeAddressFromList(union.applicants, msg.sender); // Update applicant records

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: false, timestamp: uint64(block.timestamp), member: msg.sender})
        );

        emit InviteAccepted(_unionId, msg.sender);
    }

    function sendApplication(uint256 _unionId)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
    {
        Player storage player = gs().players[msg.sender];
        require(player.unionId == 0, "Already part of a union");
        require(!isInvitee(_unionId, msg.sender), "Can acceptInvite");
        require(!isApplicant(_unionId, msg.sender), "Already in Applicant list");
        require(!isMember(_unionId, msg.sender), "Already in this union");
        require(
            gs().players[msg.sender].leaveUnionTimestamp + gs().unionRejoinCooldown <=
                block.timestamp,
            "in rejoin cooldown time"
        );

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        require(union.members.length < getMaxMembers(union.level), "Union is full");
        union.applicants.push(msg.sender);
        gs().isApplicant[_unionId][msg.sender] = true;

        emit ApplicationSent(_unionId, msg.sender);
    }

    function cancelApplication(uint256 _unionId)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
    {
        require(isApplicant(_unionId, msg.sender), "Not in Applicant list");
        require(!isMember(_unionId, msg.sender), "Already in this union");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        gs().isApplicant[_unionId][msg.sender] = false;
        removeAddressFromList(union.applicants, msg.sender);

        emit ApplicationCanceled(_unionId, msg.sender);
    }

    function rejectApplication(uint256 _unionId, address _applicant)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        require(_applicant != address(0), "Invalid applicant address");
        require(gs().players[_applicant].isInitialized, "Only initialized player");
        require(!isMember(_unionId, _applicant), "union member");
        require(!isInvitee(_unionId, _applicant), "union invitee");
        require(isApplicant(_unionId, _applicant), "In union applicant list");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        gs().isApplicant[_unionId][_applicant] = false;
        removeAddressFromList(union.applicants, _applicant);

        emit ApplicationRejected(_unionId, _applicant);
    }

    function acceptApplication(uint256 _unionId, address _applicant)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        require(_applicant != address(0), "Invalid applicant address");
        require(gs().players[_applicant].isInitialized, "Only initialized player");
        require(gs().players[_applicant].unionId == 0, "Already part of a union");
        require(!isMember(_unionId, _applicant), "Not union member");
        require(isApplicant(_unionId, _applicant), "In union applicant list");

        require(
            gs().players[_applicant].leaveUnionTimestamp + gs().unionRejoinCooldown <=
                block.timestamp,
            "in rejoin cooldown time"
        );

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        gs().isMember[_unionId][_applicant] = true;
        union.members.push(_applicant);
        gs().isApplicant[_unionId][_applicant] = false;
        removeAddressFromList(union.applicants, _applicant);
        gs().isInvitee[_unionId][_applicant] = false;
        removeAddressFromList(union.invitees, _applicant);

        gs().players[_applicant].unionId = _unionId;

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: false, timestamp: uint64(block.timestamp), member: _applicant})
        );

        emit ApplicationAccepted(_unionId, _applicant);
    }

    function leaveUnion(uint256 _unionId)
        public
        onlyWhitelisted
        notPaused
        validUnion(_unionId)
        onlyUnionMember(_unionId)
    {
        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        require(msg.sender != union.leader, "Leader cannot leave the union");

        gs().isMember[_unionId][msg.sender] = false;
        removeAddressFromList(union.members, msg.sender);
        gs().isInvitee[_unionId][msg.sender] = false;
        removeAddressFromList(union.invitees, msg.sender);
        gs().isApplicant[_unionId][msg.sender] = false;
        removeAddressFromList(union.applicants, msg.sender);

        gs().players[msg.sender].leaveUnionTimestamp = block.timestamp;
        // Clear user's union reference
        gs().players[msg.sender].unionId = 0;

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: true, timestamp: uint64(block.timestamp), member: msg.sender})
        );

        emit MemberLeft(_unionId, msg.sender);
    }

    function kickMember(uint256 _unionId, address _member)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        address account = _member;
        require(isMember(_unionId, account), "Member is not part of your union");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        require(account != union.leader, "Leader cannot kick themselves");

        gs().isMember[_unionId][account] = false;
        removeAddressFromList(union.members, account);
        gs().isInvitee[_unionId][account] = false;
        removeAddressFromList(union.invitees, account);
        gs().isApplicant[_unionId][msg.sender] = false;
        removeAddressFromList(union.applicants, _member);
        // Clear user's union reference
        gs().players[_member].unionId = 0;

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: true, timestamp: uint64(block.timestamp), member: _member})
        );

        emit MemberKicked(_unionId, _member);
    }

    function transferLeaderRole(uint256 _unionId, address _newLeader)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        require(_newLeader != address(0), "invalid address");
        require(gs().players[_newLeader].isInitialized, "only intialized player");
        require(isMember(_unionId, _newLeader), "New admin must be a member");

        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        address _oldLeader = union.leader;
        require(_newLeader != union.leader, "change leader");
        union.leader = _newLeader;

        emit UnionTransferred(_unionId, _oldLeader, _newLeader);
    }

    function changeUnionName(uint256 _unionId, string memory _name)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        union.name = _name;

        emit UnionNameChanged(_unionId, _name);
    }

    function disbandUnion(uint256 _unionId)
        public
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");

        address[] memory members = union.members;

        // Clear all members
        for (uint256 i = 0; i < union.members.length; i++) {
            gs().players[union.members[i]].unionId = 0;
        }

        // update union log
        ls().unionLog[_unionId].memberLogs.push(
            MemberLog({left: true, timestamp: uint64(block.timestamp), member: address(0)})
        );

        delete gs().unions[_unionId];

        emit UnionDisbanded(_unionId, members);
    }

    function getLevelUpUnionFee(uint256 level) public view returns (uint256) {
        return level * 2 * getUnionUpgradeFeePreMember();
    }

    function levelUpUnion(uint256 _unionId)
        public
        payable
        notPaused
        validUnion(_unionId)
        onlyWhitelisted
        onlyAdminOrUnionLeader(_unionId)
    {
        Union storage union = gs().unions[_unionId];
        require(union.unionId == _unionId, "Union is disbanded");
        uint256 MAX_LEVEL = 3;
        require(union.level < MAX_LEVEL, "Union has reached the maximum level");

        uint256 value = getLevelUpUnionFee(union.level + 1);
        require(msg.value == value, "Wrong value sent");

        // update union upgrade log
        ls().unionLog[_unionId].upgradedAt[union.level] = block.timestamp;

        union.level += 1;

        emit UnionLeveledUp(_unionId, union.level);
    }
}
