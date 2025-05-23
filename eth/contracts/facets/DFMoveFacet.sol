// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Contract imports
import {DFVerifierFacet} from "./DFVerifierFacet.sol";

// Library imports
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";
import {LibArtifactUtils} from "../libraries/LibArtifactUtils.sol";
import {LibPlanet} from "../libraries/LibPlanet.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Type imports
import {ArrivalData, ArrivalType, Artifact, ArtifactType, DFPCreateArrivalArgs, DFPMoveArgs, Planet, PlanetEventMetadata, PlanetEventType, PlanetType, Upgrade} from "../DFTypes.sol";

contract DFMoveFacet is WithStorage {
    modifier notPaused() {
        require(!gs().paused, "Game is paused");
        _;
    }

    event ArrivalQueued(
        address player,
        uint256 arrivalId,
        uint256 from,
        uint256 to,
        uint256 artifactId,
        uint256 abandoning
    );

    event WorldRadiusUpdated(uint256 radius);
    event InnerRadiusUpdated(uint256 radius);

    function move(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[11] memory _input,
        uint256 popMoved,
        uint256 silverMoved,
        uint256 movedArtifactId,
        uint256 isAbandoning
    ) public notPaused returns (uint256) {
        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[5], _input[6], _input[7], _input[8], _input[9]],
            false
        );

        DFPMoveArgs memory args = DFPMoveArgs({
            oldLoc: _input[0],
            newLoc: _input[1],
            maxDist: _input[4],
            popMoved: popMoved,
            silverMoved: silverMoved,
            movedArtifactId: movedArtifactId,
            abandoning: isAbandoning,
            sender: msg.sender
        });

        if (_isSpaceshipMove(args)) {
            // If spaceships moves are not address(0)
            // they can conquer planets with 0 energy
            args.sender = address(0);
        }

        uint256 newPerlin = _input[2];
        uint256 newRadius = _input[3];

        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            require(
                DFVerifierFacet(address(this)).verifyMoveProof(_a, _b, _c, _input),
                "Failed move proof check"
            );
        }

        // check radius

        //Round 4 Todo: need to check the zk circuits here
        require(newRadius <= gs().worldRadius, "Attempting to move out of bounds");

        uint256 targetDistFromOriginSquare = _input[10];
        require(
            targetDistFromOriginSquare >= gs().innerRadius * gs().innerRadius,
            "Attempting to move out of bounds"
        );

        // Refresh fromPlanet first before doing any action on it
        LibPlanet.refreshPlanet(args.oldLoc);

        gs().planetEventsCount++;

        // Only perform if the toPlanet have never initialized previously
        if (!gs().planets[args.newLoc].isInitialized) {
            // LibPlanet.initializePlanetWithDefaults(args.newLoc, newPerlin, false);
            LibPlanet.initializePlanetWithDefaults(args.newLoc, newPerlin, _input[10], false);
        } else {
            // need to do this so people can't deny service to planets with gas limit
            LibPlanet.refreshPlanet(args.newLoc);
            LibGameUtils.checkPlanetDOS(args.newLoc, args.sender, movedArtifactId);
        }

        if (gs().artifacts[args.movedArtifactId].artifactType == ArtifactType.ShipMothership) {
            require(
                !LibGameUtils.checkPlanetHasMothership(args.newLoc),
                "Planet already has mothership"
            );
        }

        gs().players[msg.sender].moveCount++;
        _executeMove(args);

        LibGameUtils.updateWorldRadius();
        LibGameUtils.updateInnerRadius();
        emit WorldRadiusUpdated(gs().worldRadius);
        emit InnerRadiusUpdated(gs().innerRadius);

        emit ArrivalQueued(
            msg.sender,
            gs().planetEventsCount,
            args.oldLoc,
            args.newLoc,
            args.movedArtifactId,
            args.abandoning
        );
        ls().moveCnt++;
        ls().playerLog[msg.sender].moveCnt++;
        _moreOnchainLogs(args.oldLoc, args.newLoc);
        return (gs().planetEventsCount);
    }

    function _executeMove(DFPMoveArgs memory args) private {
        _checkMoveValidity(args);

        uint256 effectiveDistTimesHundred = args.maxDist * 100; // for precision
        ArrivalType arrivalType = ArrivalType.Normal;
        Upgrade memory temporaryUpgrade = LibGameUtils.defaultUpgrade();
        bool photoidPresent = false;

        // (bool wormholePresent, uint256 distModifier) = _checkWormhole(args);
        // if (wormholePresent) {
        //     effectiveDistTimesHundred /= distModifier;
        //     arrivalType = ArrivalType.Wormhole;
        // }

        // if (!_isSpaceshipMove(args)) {
        //     (bool newPhotoidPresent, Upgrade memory newTempUpgrade) = _checkPhotoid(args);
        //     if (newPhotoidPresent) {
        //         temporaryUpgrade = newTempUpgrade;
        //         photoidPresent = newPhotoidPresent;
        //         arrivalType = ArrivalType.Photoid;
        //     }
        // }

        // _removeSpaceshipEffectsFromOriginPlanet(args);

        uint256 popMoved = args.popMoved;
        uint256 silverMoved = args.silverMoved;
        uint256 remainingOriginPlanetPopulation = gs().planets[args.oldLoc].population - popMoved;

        if (gameConstants().SPACE_JUNK_ENABLED && !_isSpaceshipMove(args)) {
            if (args.abandoning != 0) {
                (
                    uint256 newPopMoved,
                    uint256 newSilverMoved,
                    uint256 newRemainingOriginPlanetPopulation,
                    Upgrade memory abandonUpgrade
                ) = _abandonPlanet(args);

                popMoved = newPopMoved;
                silverMoved = newSilverMoved;
                remainingOriginPlanetPopulation = newRemainingOriginPlanetPopulation;
                temporaryUpgrade = abandonUpgrade;
            }

            _transferPlanetSpaceJunkToPlayer(args);
        }

        LibGameUtils._buffPlanet(args.oldLoc, temporaryUpgrade);

        uint256 travelTime = effectiveDistTimesHundred /
            ((gs().planets[args.oldLoc].speed * gs().dynamicTimeFactor) / 100);
        uint256 unionId = gs().players[gs().planets[args.oldLoc].owner].unionId;
        // don't allow 0 second voyages, so that arrival can't be processed in same block
        if (travelTime == 0) {
            travelTime = 1;
        }

        // NOTE: We have disabled the change the photoid travel time in seconds here
        // all photoid travel same time
        // if (photoidPresent) {
        //     travelTime = 600;
        // }

        Planet memory toPlanet = gs().planets[args.newLoc];
        if (toPlanet.planetType == PlanetType.SILVER_BANK) {
            travelTime /= 2;
        }

        // all checks pass. execute move
        // push the new move into the planetEvents array for args.newLoc
        gs().planetEvents[args.newLoc].push(
            PlanetEventMetadata(
                gs().planetEventsCount,
                PlanetEventType.ARRIVAL,
                block.timestamp + travelTime,
                block.timestamp
            )
        );

        _createArrival(
            DFPCreateArrivalArgs(
                args.sender,
                args.oldLoc,
                args.newLoc,
                args.maxDist,
                effectiveDistTimesHundred,
                popMoved,
                silverMoved,
                travelTime,
                args.movedArtifactId,
                arrivalType,
                unionId
            )
        );
        LibGameUtils._debuffPlanet(args.oldLoc, temporaryUpgrade);

        gs().planets[args.oldLoc].silver -= silverMoved;
        gs().planets[args.oldLoc].population = remainingOriginPlanetPopulation;
    }

    /**
        Reverts transaction if the movement is invalid.
     */
    function _checkMoveValidity(DFPMoveArgs memory args) private view {
        if (_isSpaceshipMove(args)) {
            require(args.popMoved == 0, "ship moves must move 0 energy");
            require(args.silverMoved == 0, "ship moves must move 0 silver");
            // require(
            //     gs().artifacts[args.movedArtifactId].controller == msg.sender,
            //     "you can only move your own ships"
            // );
        } else {
            // we want strict > so that the population can't go to 0
            require(
                gs().planets[args.oldLoc].population > args.popMoved,
                "Tried to move more population that what exists"
            );
            require(
                !gs().planets[args.newLoc].destroyed && !gs().planets[args.oldLoc].destroyed,
                "planet is destroyed"
            );

            require(
                !gs().planets[args.newLoc].frozen && !gs().planets[args.oldLoc].frozen,
                "planet is frozen"
            );
            require(
                gs().planets[args.oldLoc].owner == msg.sender,
                "Only owner account can perform that operation on planet."
            );
        }

        require(
            gs().planets[args.oldLoc].silver >= args.silverMoved,
            "Tried to move more silver than what exists"
        );

        if (args.movedArtifactId != 0) {
            require(
                gs().planetArtifacts[args.newLoc].length < gameConstants().MAX_ARTIFACT_PER_PLANET,
                "too many artifacts on this planet"
            );
        }
    }

    // function applySpaceshipDepart(Artifact memory artifact, Planet memory planet)
    //     public
    //     view
    //     returns (Planet memory)
    // {
    //     if (planet.isHomePlanet) {
    //         return planet;
    //     }

    //     if (artifact.artifactType == ArtifactType.ShipMothership) {
    //         if (planet.energyGroDoublers == 1) {
    //             planet.energyGroDoublers--;
    //             planet.populationGrowth /= 2;
    //         } else if (planet.energyGroDoublers > 1) {
    //             planet.energyGroDoublers--;
    //         }
    //     } else if (artifact.artifactType == ArtifactType.ShipWhale) {
    //         if (planet.silverGroDoublers == 1) {
    //             planet.silverGroDoublers--;
    //             planet.silverGrowth /= 2;
    //         } else if (planet.silverGroDoublers > 1) {
    //             planet.silverGroDoublers--;
    //         }
    //     } else if (artifact.artifactType == ArtifactType.ShipTitan) {
    //         // so that updating silver/energy starts from the current time,
    //         // as opposed to the last time that the planet was updated
    //         planet.lastUpdated = block.timestamp;
    //         planet.pausers--;
    //     }

    //     return planet;
    // }

    /**
        Undo the spaceship effects that were applied when the ship arrived on the planet.
     */
    // function _removeSpaceshipEffectsFromOriginPlanet(DFPMoveArgs memory args) private {
    //     Artifact memory movedArtifact = gs().artifacts[args.movedArtifactId];
    //     Planet memory planet = applySpaceshipDepart(movedArtifact, gs().planets[args.oldLoc]);
    //     gs().planets[args.oldLoc] = planet;
    // }

    /**
        If an active wormhole is present on the origin planet,
        return the modified distance between the origin and target
        planet.
     */
    // function _checkWormhole(DFPMoveArgs memory args)
    //     private
    //     view
    //     returns (bool wormholePresent, uint256 effectiveDistModifier)
    // {
    //     Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(args.oldLoc);
    //     Artifact memory activeArtifactTo = LibGameUtils.getActiveArtifact(args.newLoc);

    //     bool fromHasActiveWormhole = activeArtifactFrom.isInitialized &&
    //         activeArtifactFrom.artifactType == ArtifactType.Wormhole &&
    //         activeArtifactFrom.linkTo == args.newLoc;

    //     bool toHasActiveWormhole = activeArtifactTo.isInitialized &&
    //         activeArtifactTo.artifactType == ArtifactType.Wormhole &&
    //         activeArtifactTo.linkTo == args.oldLoc;

    //     uint256[6] memory speedBoosts = [uint256(1), 2, 4, 8, 16, 32];
    //     uint256 greaterRarity;

    //     if (fromHasActiveWormhole && toHasActiveWormhole) {
    //         wormholePresent = true;
    //         greaterRarity = uint256(activeArtifactFrom.rarity);
    //         if (uint256(activeArtifactTo.rarity) > greaterRarity)
    //             greaterRarity = uint256(activeArtifactTo.rarity);
    //         effectiveDistModifier = speedBoosts[greaterRarity];
    //     } else if (fromHasActiveWormhole) {
    //         wormholePresent = true;
    //         greaterRarity = uint256(activeArtifactFrom.rarity);
    //         effectiveDistModifier = speedBoosts[greaterRarity];
    //     } else if (toHasActiveWormhole) {
    //         wormholePresent = true;
    //         greaterRarity = uint256(activeArtifactTo.rarity);
    //         effectiveDistModifier = speedBoosts[greaterRarity];
    //     } else {
    //         wormholePresent = false;
    //     }
    // }

    /**
        If an active photoid cannon is present, return
        the upgrade that should be applied to the origin
        planet.
     */
    // function _checkPhotoid(DFPMoveArgs memory args)
    //     private
    //     returns (bool photoidPresent, Upgrade memory temporaryUpgrade)
    // {
    //     Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(args.oldLoc);
    //     Artifact memory activeArtifactTo = LibGameUtils.getActiveArtifact(args.newLoc);

    //     Planet memory newPlanet = gs().planets[args.newLoc];

    //     if (
    //         activeArtifactFrom.isInitialized &&
    //         activeArtifactFrom.artifactType == ArtifactType.PhotoidCannon &&
    //         block.timestamp - activeArtifactFrom.lastActivated >=
    //         gameConstants().PHOTOID_ACTIVATION_DELAY
    //     ) {
    //         photoidPresent = true;
    //         LibArtifactUtils.deactivateArtifact(args.oldLoc);
    //         temporaryUpgrade = LibGameUtils.timeDelayUpgrade(activeArtifactFrom);

    //         if (
    //             activeArtifactTo.isInitialized &&
    //             activeArtifactTo.artifactType == ArtifactType.StellarShield
    //         ) {
    //             require(
    //                 activeArtifactFrom.rarity >= activeArtifactTo.rarity,
    //                 "Photoid Canon rarity >= Stellar Shield rarity"
    //             );
    //         }
    //     }
    // }

    function _abandonPlanet(DFPMoveArgs memory args)
        private
        returns (
            uint256 popMoved,
            uint256 silverMoved,
            uint256 remainingOriginPlanetPopulation,
            Upgrade memory temporaryUpgrade
        )
    {
        require(
            // This is dependent on Arrival being the only type of planet event.
            gs().planetEvents[args.oldLoc].length == 0,
            "Cannot abandon a planet that has incoming voyages."
        );

        require(!gs().planets[args.oldLoc].isHomePlanet, "Cannot abandon home planet");

        // When abandoning a planet:
        // 1. Always send full energy and silver
        // 2. Receive a range / speed boost
        // 3. Transfer ownership to 0 address
        // 4. Place double the default amount of space pirates
        // 5. Subtract space junk from player total
        popMoved = gs().planets[args.oldLoc].population;
        silverMoved = gs().planets[args.oldLoc].silver;
        remainingOriginPlanetPopulation =
            LibGameUtils
                ._defaultPlanet(
                    args.oldLoc,
                    gs().planets[args.oldLoc].planetLevel,
                    gs().planets[args.oldLoc].planetType,
                    gs().planets[args.oldLoc].spaceType,
                    gameConstants().TIME_FACTOR_HUNDREDTHS
                )
                .population *
            2;
        temporaryUpgrade = LibGameUtils.abandoningUpgrade();

        uint256 planetSpaceJunk = LibGameUtils.getPlanetDefaultSpaceJunk(gs().planets[args.oldLoc]);

        if (LibGameUtils.isHalfSpaceJunk(args.oldLoc)) {
            planetSpaceJunk /= 2;
        }

        if (planetSpaceJunk >= gs().players[msg.sender].spaceJunk) {
            gs().players[msg.sender].spaceJunk = 0;
        } else {
            gs().players[msg.sender].spaceJunk -= planetSpaceJunk;
        }

        gs().planets[args.oldLoc].spaceJunk = planetSpaceJunk;
        gs().planets[args.oldLoc].owner = address(0);
    }

    /**
        Make sure players don't take on more junk than they are allowed to.
        Properly increment players space junk and remove the junk from the
        target planet.
     */
    function _transferPlanetSpaceJunkToPlayer(DFPMoveArgs memory args) private {
        // Planet storage sourcePlanet = gs().planets[args.oldLoc];
        // Planet storage targetPlanet = gs().planets[args.newLoc];

        require(
            (gs().players[msg.sender].spaceJunk + gs().planets[args.newLoc].spaceJunk <=
                gs().players[msg.sender].spaceJunkLimit),
            "Tried to take on more space junk than your limit"
        );

        if (gs().planets[args.newLoc].spaceJunk != 0) {
            gs().players[msg.sender].spaceJunk += gs().planets[args.newLoc].spaceJunk;
            gs().planets[args.newLoc].spaceJunk = 0;
        }
    }

    function _isSpaceshipMove(DFPMoveArgs memory args) private view returns (bool) {
        return LibArtifactUtils.isSpaceship(gs().artifacts[args.movedArtifactId].artifactType);
    }

    function _createArrival(DFPCreateArrivalArgs memory args) private {
        // enter the arrival data for event id
        Planet memory planet = gs().planets[args.oldLoc];
        uint256 popArriving = _getDecayedPop(
            args.popMoved,
            args.effectiveDistTimesHundred,
            planet.range,
            planet.populationCap
        );
        bool isSpaceship = LibArtifactUtils.isSpaceship(
            gs().artifacts[args.movedArtifactId].artifactType
        );
        // space ship moves are implemented as 0-energy moves
        require(popArriving > 0 || isSpaceship, "Not enough forces to make move");
        require(isSpaceship ? args.popMoved == 0 : true, "spaceship moves must be 0 energy moves");

        uint256 unionId = gs().players[args.player].unionId;

        gs().planetArrivals[gs().planetEventsCount] = ArrivalData({
            id: gs().planetEventsCount,
            player: args.player, // player address or address(0) for ship moves
            fromPlanet: args.oldLoc,
            toPlanet: args.newLoc,
            popArriving: popArriving,
            silverMoved: args.silverMoved,
            departureTime: block.timestamp,
            arrivalTime: block.timestamp + args.travelTime,
            arrivalType: args.arrivalType,
            carriedArtifactId: args.movedArtifactId,
            distance: args.actualDist,
            unionId: unionId,
            name: gs().unions[unionId].name,
            leader: gs().unions[unionId].leader,
            level: gs().unions[unionId].level,
            members: gs().unions[unionId].members,
            invitees: gs().unions[unionId].invitees
        });

        gs().targetPlanetArrivalIds[args.newLoc].push(gs().planetEventsCount);

        if (args.movedArtifactId != 0) {
            LibGameUtils._takeArtifactOffPlanet(args.movedArtifactId, args.oldLoc);
            gs().artifactIdToVoyageId[args.movedArtifactId] = gs().planetEventsCount;
        }
    }

    function _getDecayedPop(
        uint256 _popMoved,
        uint256 distTimesHundred,
        uint256 _range,
        uint256 _populationCap
    ) private pure returns (uint256 _decayedPop) {
        int128 _scaleInv = ABDKMath64x64.exp_2(ABDKMath64x64.divu(distTimesHundred, _range * 100));
        int128 _bigPlanetDebuff = ABDKMath64x64.divu(_populationCap, 20);
        int128 _beforeDebuff = ABDKMath64x64.div(ABDKMath64x64.fromUInt(_popMoved), _scaleInv);
        if (_beforeDebuff > _bigPlanetDebuff) {
            _decayedPop = ABDKMath64x64.toUInt(ABDKMath64x64.sub(_beforeDebuff, _bigPlanetDebuff));
        } else {
            _decayedPop = 0;
        }
    }

    function _moreOnchainLogs(uint256 oldLoc, uint256 newLoc) private {
        if (ls().firstMoveTimestamp == 0) {
            ls().firstMoveTimestamp = block.timestamp;
        }
        uint256 daysPassed = (block.timestamp - ls().firstMoveTimestamp) / 1 days;
        ls().moveCntPerDay[daysPassed]++;
        // Check if from and to planets belong to different players
        address fromOwner = gs().planets[oldLoc].owner;
        address toOwner = gs().planets[newLoc].owner;
        if (toOwner != address(0) && fromOwner != toOwner) {
            uint256 fromUnionId = gs().players[fromOwner].unionId;
            uint256 toUnionId = gs().players[toOwner].unionId;

            // If both planets are in same non-zero union, increment assist count
            if (fromUnionId != 0 && fromUnionId == toUnionId) {
                ls().assistCntPerDay[daysPassed]++;
            }
            // If planets are in different/no unions, increment attack count
            else {
                ls().attackCntPerDay[daysPassed]++;
            }
        }
    }
}
