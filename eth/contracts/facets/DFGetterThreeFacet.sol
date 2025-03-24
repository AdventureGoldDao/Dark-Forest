// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;
// External contract imports
import {DFArtifactFacet} from "./DFArtifactFacet.sol";

// Library imports
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";

// Storage imports
import {WithStorage, SnarkConstants, GameConstants} from "../libraries/LibStorage.sol";

// Type imports
import {UnionLog, CaptureLog} from "../DFTypes.sol";

contract DFGetterThreeFacet is WithStorage {
    function getDailyMoveCnt(uint256 dayFrom, uint256 dayTo)
        public
        view
        returns (
            uint256[] memory moveCnt,
            uint256[] memory assistCnt,
            uint256[] memory attackCnt
        )
    {
        moveCnt = new uint256[](dayTo - dayFrom);
        assistCnt = new uint256[](dayTo - dayFrom);
        attackCnt = new uint256[](dayTo - dayFrom);
        for (uint256 i = dayFrom; i < dayTo; i++) {
            moveCnt[i - dayFrom] = ls().moveCntPerDay[i];
            assistCnt[i - dayFrom] = ls().assistCntPerDay[i];
            attackCnt[i - dayFrom] = ls().attackCntPerDay[i];
        }
    }

    function getUnionLog(uint256 fromIndex, uint256 toIndex)
        public
        view
        returns (UnionLog[] memory ret)
    {
        ret = new UnionLog[](toIndex - fromIndex);
        for (uint256 i = fromIndex; i < toIndex; i++) {
            ret[i - fromIndex] = ls().unionLog[i];
        }
    }

    function getCaptureLog(address[] memory players)
        public
        view
        returns (CaptureLog[][] memory ret)
    {
        ret = new CaptureLog[][](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            ret[i] = ls().playerLog[players[i]].captureLogs;
        }
    }

    function getCaptureLogByPlayerId(uint256 fromIndex, uint256 toIndex)
        public
        view
        returns (CaptureLog[][] memory ret)
    {
        ret = new CaptureLog[][](toIndex - fromIndex);
        for (uint256 i = fromIndex; i < toIndex; i++) {
            ret[i - fromIndex] = ls().playerLog[gs().playerIds[i]].captureLogs;
        }
    }
}
