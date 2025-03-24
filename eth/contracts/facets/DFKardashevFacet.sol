// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// External contract imports
import {DFCoreFacet} from "./DFCoreFacet.sol";
import {DFWhitelistFacet} from "./DFWhitelistFacet.sol";
import {DFCaptureFacet} from "./DFCaptureFacet.sol";
import {DFArtifactFacet} from "./DFArtifactFacet.sol";

// Library imports
import {LibPlanet} from "../libraries/LibPlanet.sol";
import {LibDiamond} from "../vendor/libraries/LibDiamond.sol";
import {LibGameUtils} from "../libraries/LibGameUtils.sol";
import {LibArtifactUtils} from "../libraries/LibArtifactUtils.sol";

// Storage imports
import {WithStorage} from "../libraries/LibStorage.sol";

// Vendor Imports
import {LibTrig} from "../vendor/libraries/LibTrig.sol";
import {ABDKMath64x64} from "../vendor/libraries/ABDKMath64x64.sol";

// Type imports
import {Planet, PlanetType, Player, BurnedCoords, Artifact, ArtifactType, KardashevCoords, RevealedCoords} from "../DFTypes.sol";

contract DFKardashevFacet is WithStorage {
    modifier notPaused() {
        require(!gs().paused, "Game is paused");
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

    modifier disabled() {
        require(false, "This functionality is disabled for the current round.");
        _;
    }

    event Kardashev(address player, uint256 loc, uint256 x, uint256 y);
    event LocationRevealed(address revealer, uint256 loc, uint256 x, uint256 y);
    event LocationBlued(
        address player,
        uint256 sourcePlanetId,
        uint256 x,
        uint256 y,
        uint256 targetPlanetId
    );

    /**
     * Same snark args as DFCoreFacet#revealLocation
     */
    function kardashev(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public onlyWhitelisted notPaused disabled {
        require(
            block.timestamp < gameConstants().KARDASHEV_END_TIMESTAMP,
            "Cannot kardashe planet after the round has ended"
        );
        require(
            block.timestamp - gs().lastKardashevTimestamp[msg.sender] >
                gameConstants().KARDASHEV_PLANET_COOLDOWN,
            "wait for cooldown before kardashev again"
        );

        require(
            DFCoreFacet(address(this)).checkRevealProof(_a, _b, _c, _input),
            "Failed reveal pf check"
        );

        uint256 x = _input[2];
        uint256 y = _input[3];
        int256 planetX = DFCaptureFacet(address(this)).getIntFromUInt(x);
        int256 planetY = DFCaptureFacet(address(this)).getIntFromUInt(y);
        uint256 distFromOriginSquare = uint256(planetX * planetX + planetY * planetY);

        if (!gs().planets[_input[0]].isInitialized) {
            LibPlanet.initializePlanetWithDefaults(
                _input[0],
                _input[1],
                distFromOriginSquare,
                false
            );
        }

        uint256 planetId = _input[0];
        LibPlanet.refreshPlanet(planetId);

        Planet storage planet = gs().planets[planetId];
        Player storage player = gs().players[msg.sender];

        //destoryed or frozen
        require(!planet.destroyed, "planet is destroyed");
        require(!planet.frozen, "planet is frozen");

        //kardashev before
        require(planet.kardashevTimestamp == 0, "kardashev this planet before");
        require(gs().kardashevCoords[planetId].locationId == 0, "kardashev before");

        // planet owner & level
        require(planet.owner == msg.sender, "only you");
        require(planet.planetLevel >= 3, "planet level >= 3");

        //active artifact & cooldown check
        bool activeKardashev = false;
        Artifact memory activeArtifact = LibGameUtils.getActiveArtifact(planetId);
        if (activeArtifact.isInitialized && activeArtifact.artifactType == ArtifactType.Kardashev) {
            require(
                block.timestamp - activeArtifact.lastActivated >
                    gameConstants().KARDASHEV_PLANET_COOLDOWN,
                "active artifact cooldown"
            );

            activeKardashev = true;
            LibArtifactUtils.deactivateAndBurn(planetId, activeArtifact.id, 0, activeArtifact);
        }
        require(activeKardashev, "need active kardashev");

        // silver amount
        uint256 silverAmount = gameConstants().KARDASHEV_REQUIRE_SILVER_AMOUNTS[planet.planetLevel];
        require(gs().players[msg.sender].silver >= silverAmount * 1000, "silver is not enough");

        require(
            block.timestamp - gs().lastKardashevTimestamp[msg.sender] >
                gameConstants().KARDASHEV_PLANET_COOLDOWN,
            "kardashev cooldown"
        );

        player.kardashevAmount++;
        player.silver -= silverAmount * 1000;

        planet.kardashevOperator = msg.sender;

        gs().lastKardashevTimestamp[msg.sender] = block.timestamp;
        planet.kardashevTimestamp = block.timestamp;

        gs().kardashevIds.push(planetId);
        gs().kardashevPlanets[msg.sender].push(planetId);
        gs().kardashevCoords[planetId] = KardashevCoords({
            locationId: planetId,
            x: x,
            y: y,
            operator: msg.sender,
            kardashevAt: block.timestamp
        });

        if (ls().firstKardashevOperator == address(0)) ls().firstKardashevOperator = msg.sender;
        emit Kardashev(msg.sender, _input[0], _input[2], _input[3]);
        ls().kardashevCnt++;
        ls().playerLog[msg.sender].kardashevCnt++;
    }

    function blueLocation(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input
    ) public onlyWhitelisted notPaused disabled {
        require(
            block.timestamp < gameConstants().KARDASHEV_END_TIMESTAMP,
            "Cannot kardashe planet after the round has ended"
        );

        require(
            DFCoreFacet(address(this)).checkRevealProof(_a, _b, _c, _input),
            "Failed reveal pf check"
        );

        uint256 x = _input[2];
        uint256 y = _input[3];
        int256 planetX = DFCaptureFacet(address(this)).getIntFromUInt(x);
        int256 planetY = DFCaptureFacet(address(this)).getIntFromUInt(y);
        uint256 distFromOriginSquare = uint256(planetX * planetX + planetY * planetY);

        if (!gs().planets[_input[0]].isInitialized) {
            LibPlanet.initializePlanetWithDefaults(
                _input[0],
                _input[1],
                distFromOriginSquare,
                false
            );
        }

        uint256 planetId = _input[0];
        LibPlanet.refreshPlanet(planetId);

        Planet storage planet = gs().planets[planetId];

        require(!planet.destroyed, "planet is destroyed");
        require(!planet.frozen, "planet is frozen");
        require(planet.planetLevel >= 3, "planet level >=3");

        uint256 centerPlanetId = getCenterPlanetId(x, y);

        require(centerPlanetId != 0, "planet is not in your blue zone");
        require(centerPlanetId != planetId, "can't blue center planet");

        uint256 silverAmount = gameConstants().BLUE_PANET_REQUIRE_SILVER_AMOUNTS[
            planet.planetLevel
        ];

        require(gs().players[msg.sender].silver >= silverAmount * 1000, "silver is not enough");
        gs().players[msg.sender].silver -= silverAmount * 1000;

        LibPlanet.refreshPlanet(centerPlanetId);
        Planet storage centerPlanet = gs().planets[centerPlanetId];

        require(
            block.timestamp - planet.kardashevTimestamp > gameConstants().BLUE_PLANET_COOLDOWN,
            "blue cooldown"
        );

        require(planet.owner == centerPlanet.owner, "planet owner is the same");
        require(centerPlanet.owner == msg.sender, "center planet is yours");

        centerPlanet.population += planet.population;
        centerPlanet.silver += planet.silver;
        // make sure pop is never 0
        planet.population = 3000;
        planet.silver = 0;

        if (centerPlanet.silver > centerPlanet.silverCap)
            centerPlanet.silver = centerPlanet.silverCap;

        if (centerPlanet.planetType == PlanetType.SILVER_BANK || centerPlanet.pausers > 0) {
            if (centerPlanet.population > centerPlanet.populationCap) {
                centerPlanet.population = centerPlanet.populationCap;
            }
        }

        if (gs().revealedCoords[planetId].locationId == 0) {
            gs().revealedPlanetIds.push(planetId);
            gs().revealedCoords[planetId] = RevealedCoords({
                locationId: planetId,
                x: x,
                y: y,
                revealer: msg.sender
            });

            //NOTE: blueLocation don't update player's lastRevealTimestamp
            // gs().players[msg.sender].lastRevealTimestamp = block.timestamp;
            emit LocationRevealed(msg.sender, planetId, x, y);
        }
        emit LocationBlued(msg.sender, planet.locationId, x, y, centerPlanet.locationId);
        ls().blueLocationCnt++;
        ls().playerLog[msg.sender].blueLocationCnt++;
    }

    function getCenterPlanetId(uint256 x, uint256 y) public returns (uint256) {
        int256 planetX = DFCaptureFacet(address(this)).getIntFromUInt(x);
        int256 planetY = DFCaptureFacet(address(this)).getIntFromUInt(y);

        uint256 centerPlanetId = 0;
        uint256 dis = 0;

        uint256[] memory kardashevPlanets = gs().kardashevPlanets[msg.sender];
        for (uint256 i = 0; i < kardashevPlanets.length; i++) {
            uint256 planetId = kardashevPlanets[i];
            Planet memory planet = gs().planets[planetId];
            KardashevCoords memory center = gs().kardashevCoords[planetId];

            int256 centerX = DFCaptureFacet(address(this)).getIntFromUInt(center.x);
            int256 centerY = DFCaptureFacet(address(this)).getIntFromUInt((center.y));

            int256 xDiff = (planetX - centerX);
            int256 yDiff = (planetY - centerY);
            uint256 distanceToZone = DFCaptureFacet(address(this)).sqrt(
                uint256(xDiff * xDiff + yDiff * yDiff)
            );

            if (distanceToZone <= gameConstants().KARDASHEV_EFFECT_RADIUS[planet.planetLevel]) {
                if (centerPlanetId == 0) {
                    centerPlanetId = planet.locationId;
                    dis = distanceToZone;
                } else if (distanceToZone < dis) {
                    centerPlanetId = planet.locationId;
                    dis = distanceToZone;
                } else if (distanceToZone == dis) {
                    Planet memory tmp = gs().planets[centerPlanetId];
                    if (tmp.kardashevTimestamp > planet.kardashevTimestamp) {
                        centerPlanetId = planet.locationId;
                        dis = distanceToZone;
                    }
                }
            }
        }

        return centerPlanetId;
    }
}
