// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Library imports
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";
import {LibGameUtils} from "./LibGameUtils.sol";

// Storage imports
import {LibStorage, GameStorage, GameConstants, SnarkConstants} from "./LibStorage.sol";

// Type imports
import {Planet, PlanetType, PlanetEventMetadata, PlanetEventType, ArrivalData, ArrivalType, Artifact, ArtifactType} from "../DFTypes.sol";

library LibLazyUpdate {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    function _updateSilver(uint256 updateToTime, Planet memory planet) private view {
        // This function should never be called directly and should only be called
        // by the refresh planet function. This require is in place to make sure
        // no one tries to updateSilver on non silver producing planet.
        require(
            planet.planetType == PlanetType.SILVER_MINE,
            "Can only update silver on silver producing planet"
        );
        if (planet.owner == address(0)) {
            // unowned planet doesn't gain silver
            return;
        }

        if (planet.silver < planet.silverCap - planet.lootSilver) {
            uint256 _timeDiff = updateToTime - planet.lastUpdated;
            uint256 _silverMined = planet.silverGrowth * _timeDiff; // * gs().dynamicTimeFactor) / 100;

            uint256 _maxSilver = planet.silverCap - planet.lootSilver;
            uint256 _currentSilver = planet.silver + _silverMined;
            planet.silver = _maxSilver < _currentSilver ? _maxSilver : _currentSilver;
        }
    }

    function _updatePopulation(uint256 updateToTime, Planet memory planet) private view {
        if (planet.owner == address(0)) {
            // unowned planet doesn't increase in population
            return;
        }

        int128 _timeElapsed = ABDKMath64x64.sub(
            ABDKMath64x64.fromUInt(updateToTime),
            ABDKMath64x64.fromUInt(planet.lastUpdated)
        );

        int128 _one = ABDKMath64x64.fromUInt(1);

        int128 _denominator = ABDKMath64x64.add(
            ABDKMath64x64.mul(
                ABDKMath64x64.exp(
                    ABDKMath64x64.div(
                        ABDKMath64x64.mul(
                            ABDKMath64x64.mul(
                                ABDKMath64x64.fromInt(-4),
                                ABDKMath64x64.fromUInt(
                                    planet.populationGrowth //* gs().dynamicTimeFactor) / 100
                                )
                            ),
                            _timeElapsed
                        ),
                        ABDKMath64x64.fromUInt(planet.populationCap)
                    )
                ),
                ABDKMath64x64.sub(
                    ABDKMath64x64.div(
                        ABDKMath64x64.fromUInt(planet.populationCap),
                        ABDKMath64x64.fromUInt(planet.population)
                    ),
                    _one
                )
            ),
            _one
        );

        uint256 newPopulation = ABDKMath64x64.toUInt(
            ABDKMath64x64.div(ABDKMath64x64.fromUInt(planet.populationCap), _denominator)
        );

        // If paused, no energy growth
        if (planet.pausers > 0 && newPopulation > planet.population) {
            return;
        }

        planet.population = newPopulation;

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (planet.planetType == PlanetType.SILVER_BANK || planet.pausers > 0) {
            if (planet.population > planet.populationCap) {
                planet.population = planet.populationCap;
            }
        }
    }

    function updatePlanet(uint256 updateToTime, Planet memory planet)
        public
        view
        returns (Planet memory)
    {
        _updatePopulation(updateToTime, planet);

        if (planet.planetType == PlanetType.SILVER_MINE) {
            _updateSilver(updateToTime, planet);
        }

        planet.lastUpdated = updateToTime;

        return planet;
    }

    // assumes that the planet last updated time is equal to the arrival time trigger
    function applyArrival(Planet memory planet, ArrivalData memory arrival)
        private
        view
        returns (
            uint256 newArtifactOnPlanet,
            Planet memory,
            bool
        )
    {
        bool shoudDeactiveArtifact = false;

        bool inUnion = false;
        for (uint256 i = 0; i < arrival.members.length; i++) {
            if (arrival.members[i] == planet.owner) {
                inUnion = true;
                break;
            }
        }

        // checks whether the planet is owned by the player sending ships
        if (arrival.player == planet.owner || (arrival.unionId != 0 && inUnion)) {
            // simply increase the population if so
            planet.population = planet.population + arrival.popArriving;
        } else {
            Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(planet.locationId);
            if (arrival.arrivalType == ArrivalType.Wormhole) {
                // if this is a wormhole arrival to a planet that isn't owned by the initiator of
                // the move, then don't move any energy
            } else if (
                arrival.arrivalType == ArrivalType.Photoid &&
                activeArtifactFrom.artifactType == ArtifactType.StellarShield &&
                arrival.arrivalTime >=
                activeArtifactFrom.lastActivated + gameConstants().STELLAR_ACTIVATION_DELAY
            ) {
                // check if have activated stellarshield
                // if so, don't move any energy and deactivate the stellar shield
                // stellar shield successfully blocks one attack from photoid
                // need deactivate outside here and many level view functions
                // LibArtifactUtils.deactivateArtifactWithoutCheckOwner(planet.locationId);
                shoudDeactiveArtifact = true;
            } else if (planet.population > (arrival.popArriving * 100) / planet.defense) {
                // handles if the planet population is bigger than the arriving ships
                // simply reduce the amount of planet population by the arriving ships
                planet.population =
                    planet.population -
                    ((arrival.popArriving * 100) / planet.defense);
            } else {
                // handles if the planet population is equal or less the arriving ships
                // reduce the arriving ships amount with the current population and the
                // result is the new population of the planet now owned by the attacking
                // player

                /**
                  This is the zero address so that ships moving to an unowned planet with
                  no barbarians don't cause the planet to be conquered by the ship's controller.
                 */
                if (arrival.player != address(0)) {
                    planet.owner = arrival.player;
                }
                planet.population =
                    arrival.popArriving -
                    ((planet.population * planet.defense) / 100);
                if (planet.population == 0) {
                    // make sure pop is never 0
                    planet.population = 1;
                }
            }
        }

        // quasars have 0 energy growth, so they have 0 energy decay as well
        // so don't allow them to become overful
        if (planet.planetType == PlanetType.SILVER_BANK || planet.pausers > 0) {
            if (planet.population > planet.populationCap) {
                planet.population = planet.populationCap;
            }
        }

        uint256 _maxSilver = planet.silverCap - planet.lootSilver;
        uint256 _nextSilver = planet.silver + arrival.silverMoved;
        planet.silver = _maxSilver < _nextSilver ? _maxSilver : _nextSilver;

        return (arrival.carriedArtifactId, planet, shoudDeactiveArtifact);
    }

    function applyPendingEvents(
        uint256 currentTimestamp,
        Planet memory planet,
        PlanetEventMetadata[] memory events
    )
        public
        view
        returns (
            Planet memory,
            // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here
            uint256[32] memory,
            bool
        )
    {
        // first 16 are event ids to remove
        // last 16 are artifact ids that are new on the planet
        uint256[32] memory eventIdsAndArtifacts;

        uint256 numEventsToRemove = 0;
        uint256 numNewArtifactsOnPlanet = 0;
        uint256 earliestEventTime = 0;
        uint256 earliestEventIndex = 0;
        bool shoudDeactiveArtifact = false;

        do {
            // if (events.length == 0 || planet.destroyed || planet.frozen) {
            //     break;
            // }

            if (events.length == 0) break;

            // set to to the upperbound of uint256
            earliestEventTime = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

            // loops through the array and find the earliest event time that hasn't already been applied
            for (uint256 i = 0; i < events.length; i++) {
                if (events[i].timeTrigger < earliestEventTime) {
                    bool shouldApply = true;

                    // checks if this event has already been applied.
                    for (
                        uint256 alreadyRemovedIdx = 0;
                        alreadyRemovedIdx < numEventsToRemove;
                        alreadyRemovedIdx++
                    ) {
                        if (eventIdsAndArtifacts[alreadyRemovedIdx] == events[i].id) {
                            shouldApply = false;
                            break;
                        }
                    }

                    if (shouldApply) {
                        earliestEventTime = events[i].timeTrigger;
                        earliestEventIndex = i;
                    }
                }
            }

            // only process the event if it occurs before the current time and the timeTrigger is not 0
            // which comes from uninitialized PlanetEventMetadata
            if (
                events[earliestEventIndex].timeTrigger <= currentTimestamp &&
                earliestEventTime !=
                115792089237316195423570985008687907853269984665640564039457584007913129639935
            ) {
                planet = updatePlanet(events[earliestEventIndex].timeTrigger, planet);

                if (events[earliestEventIndex].eventType == PlanetEventType.ARRIVAL) {
                    eventIdsAndArtifacts[numEventsToRemove++] = events[earliestEventIndex].id;

                    uint256 newArtifactId;
                    (newArtifactId, planet, shoudDeactiveArtifact) = applyArrival(
                        planet,
                        gs().planetArrivals[events[earliestEventIndex].id]
                    );

                    if (newArtifactId != 0) {
                        // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

                        eventIdsAndArtifacts[16 + numNewArtifactsOnPlanet++] = newArtifactId;
                    }
                }
            }
        } while (earliestEventTime <= currentTimestamp);

        return (planet, eventIdsAndArtifacts, shoudDeactiveArtifact);
    }

    // function shoudDeactiveArtifact(
    //     uint256 currentTimestamp,
    //     Planet memory planet,
    //     PlanetEventMetadata[] memory events
    // ) public view returns (bool) {
    //     // first 12 are event ids to remove
    //     // last 12 are artifact ids that are new on the planet
    //     uint256[24] memory eventIdsAndArtifacts;

    //     uint256 numEventsToRemove = 0;
    //     uint256 numNewArtifactsOnPlanet = 0;
    //     uint256 earliestEventTime = 0;
    //     uint256 earliestEventIndex = 0;

    //     do {
    //         if (events.length == 0 || planet.destroyed || planet.frozen) {
    //             break;
    //         }

    //         // set to to the upperbound of uint256
    //         earliestEventTime = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

    //         // loops through the array and find the earliest event time that hasn't already been applied
    //         for (uint256 i = 0; i < events.length; i++) {
    //             if (events[i].timeTrigger < earliestEventTime) {
    //                 bool shouldApply = true;

    //                 // checks if this event has already been applied.
    //                 for (
    //                     uint256 alreadyRemovedIdx = 0;
    //                     alreadyRemovedIdx < numEventsToRemove;
    //                     alreadyRemovedIdx++
    //                 ) {
    //                     if (eventIdsAndArtifacts[alreadyRemovedIdx] == events[i].id) {
    //                         shouldApply = false;
    //                         break;
    //                     }
    //                 }

    //                 if (shouldApply) {
    //                     earliestEventTime = events[i].timeTrigger;
    //                     earliestEventIndex = i;
    //                 }
    //             }
    //         }

    //         // only process the event if it occurs before the current time and the timeTrigger is not 0
    //         // which comes from uninitialized PlanetEventMetadata
    //         if (
    //             events[earliestEventIndex].timeTrigger <= currentTimestamp &&
    //             earliestEventTime !=
    //             115792089237316195423570985008687907853269984665640564039457584007913129639935
    //         ) {
    //             planet = updatePlanet(events[earliestEventIndex].timeTrigger, planet);

    //             if (events[earliestEventIndex].eventType == PlanetEventType.ARRIVAL) {
    //                 eventIdsAndArtifacts[numEventsToRemove++] = events[earliestEventIndex].id;

    //                 Artifact memory activeArtifactFrom = LibGameUtils.getActiveArtifact(
    //                     planet.locationId
    //                 );
    //                 if (
    //                     gs().planetArrivals[events[earliestEventIndex].id].arrivalType ==
    //                     ArrivalType.Photoid &&
    //                     activeArtifactFrom.artifactType == ArtifactType.StellarShield &&
    //                     gs().planetArrivals[events[earliestEventIndex].id].arrivalTime >=
    //                     activeArtifactFrom.lastActivated + gameConstants().STELLAR_ACTIVATION_DELAY
    //                 ) {
    //                     return true;
    //                 }
    //             }
    //         }
    //     } while (earliestEventTime <= currentTimestamp);
    //     return false;
    // }
}
