// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// Contract imports
import {DFVerifierFacet} from "../facets/DFVerifierFacet.sol";

// Library imports
import {LibGameUtils} from "./LibGameUtils.sol";
import {LibLazyUpdate} from "./LibLazyUpdate.sol";
import {LibArtifactUtils} from "./LibArtifactUtils.sol";
// Storage imports
import {LibStorage, GameStorage, GameConstants, SnarkConstants, LogStorage} from "./LibStorage.sol";

// Type imports
import {Artifact, ArtifactType, DFPInitPlanetArgs, Planet, PlanetEventMetadata, PlanetType, RevealedCoords, SpaceType, Upgrade, UpgradeBranch, ArtifactRarity, Biome} from "../DFTypes.sol";
import {CaptureLog} from "../DFTypes.sol";

library LibPlanet {
    function gs() internal pure returns (GameStorage storage) {
        return LibStorage.gameStorage();
    }

    function snarkConstants() internal pure returns (SnarkConstants storage sc) {
        return LibStorage.snarkConstants();
    }

    function gameConstants() internal pure returns (GameConstants storage) {
        return LibStorage.gameConstants();
    }

    // also need to copy some of DFCore's event signatures
    event ArtifactActivated(address player, uint256 artifactId, uint256 loc, uint256 linkTo);
    event ArtifactDeactivated(address player, uint256 artifactId, uint256 loc);
    event PlanetUpgraded(address player, uint256 loc, uint256 branch, uint256 toBranchLevel);

    function revealLocation(
        uint256 location,
        uint256 perlin,
        uint256 x,
        uint256 y,
        bool checkTimestamp
    ) public {
        if (checkTimestamp) {
            require(
                block.timestamp - gs().players[msg.sender].lastRevealTimestamp >
                    gameConstants().LOCATION_REVEAL_COOLDOWN,
                "wait for cooldown before revealing again"
            );
        }
        require(gs().revealedCoords[location].locationId == 0, "Location already revealed");
        gs().revealedPlanetIds.push(location);
        gs().revealedCoords[location] = RevealedCoords({
            locationId: location,
            x: x,
            y: y,
            revealer: msg.sender
        });
        gs().players[msg.sender].lastRevealTimestamp = block.timestamp;
    }

    //###############
    //  NEW MAP ALGO
    //###############
    function getDefaultInitPlanetArgs(
        uint256 _location,
        uint256 _perlin,
        uint256 _distFromOriginSquare,
        bool _isHomePlanet
    ) public view returns (DFPInitPlanetArgs memory) {
        (uint256 level, PlanetType planetType, SpaceType spaceType) = LibGameUtils
            ._getPlanetLevelTypeAndSpaceType(_location, _perlin, _distFromOriginSquare);

        if (_isHomePlanet) {
            require(level == 0, "Can only initialize on planet level 0");
            require(planetType == PlanetType.PLANET, "Can only initialize on regular planets");
        }

        return
            DFPInitPlanetArgs(
                _location,
                _perlin,
                level,
                gameConstants().TIME_FACTOR_HUNDREDTHS,
                spaceType,
                planetType,
                _isHomePlanet
            );
    }

    /**
     * Same SNARK args as `initializePlayer`. Adds a planet to the smart contract without setting an owner.
     */
    function initializePlanet(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[9] memory _input,
        bool isHomePlanet
    ) public {
        if (!snarkConstants().DISABLE_ZK_CHECKS) {
            require(
                DFVerifierFacet(address(this)).verifyInitProof(_a, _b, _c, _input),
                "Failed init proof check"
            );
        }

        uint256 _location = _input[0];
        uint256 _perlin = _input[1];

        LibGameUtils.revertIfBadSnarkPerlinFlags(
            [_input[3], _input[4], _input[5], _input[6], _input[7]],
            false
        );

        // Initialize planet information
        initializePlanetWithDefaults(_location, _perlin, _input[8], isHomePlanet);
    }

    //###############
    //  NEW MAP ALGO
    //###############
    function initializePlanetWithDefaults(
        uint256 _location,
        uint256 _perlin,
        uint256 _distFromOriginSquare,
        bool _isHomePlanet
    ) public {
        require(LibGameUtils._locationIdValid(_location), "Not a valid planet location");

        DFPInitPlanetArgs memory initArgs = getDefaultInitPlanetArgs(
            _location,
            _perlin,
            _distFromOriginSquare,
            _isHomePlanet
        );

        _initializePlanet(initArgs);
        gs().planetIds.push(_location);
        gs().initializedPlanetCountByLevel[initArgs.level] += 1;
    }

    function _initializePlanet(DFPInitPlanetArgs memory args) public {
        Planet storage _planet = gs().planets[args.location];
        // can't initialize a planet twice
        require(!_planet.isInitialized, "Planet is already initialized");

        // planet initialize should set the planet to default state, including having the owner be adress 0x0
        // then it's the responsibility for the mechanics to set the owner to the player

        Planet memory defaultPlanet = LibGameUtils._defaultPlanet(
            args.location,
            args.level,
            args.planetType,
            args.spaceType,
            args.TIME_FACTOR_HUNDREDTHS
        );
        _planet.locationId = args.location;
        _planet.owner = defaultPlanet.owner;
        _planet.isHomePlanet = defaultPlanet.isHomePlanet;
        _planet.range = defaultPlanet.range;
        _planet.speed = defaultPlanet.speed;
        _planet.defense = defaultPlanet.defense;
        _planet.population = defaultPlanet.population;
        _planet.populationCap = defaultPlanet.populationCap;
        _planet.populationGrowth = defaultPlanet.populationGrowth;
        _planet.silverCap = defaultPlanet.silverCap;
        _planet.silverGrowth = defaultPlanet.silverGrowth;
        _planet.silver = defaultPlanet.silver;
        _planet.planetLevel = defaultPlanet.planetLevel;
        _planet.planetType = defaultPlanet.planetType;

        _planet.isInitialized = true;
        _planet.perlin = args.perlin;
        _planet.spaceType = args.spaceType;
        _planet.createdAt = block.timestamp;
        _planet.lastUpdated = block.timestamp;
        _planet.upgradeState0 = 0;
        _planet.upgradeState1 = 0;
        _planet.upgradeState2 = 0;

        _planet.pausers = 0;
        _planet.energyGroDoublers = 0;
        _planet.silverGroDoublers = 0;

        _planet.adminProtect = defaultPlanet.adminProtect;
        _planet.destroyed = defaultPlanet.destroyed;
        _planet.frozen = defaultPlanet.frozen;
        _planet.canShow = defaultPlanet.canShow;

        if (args.isHomePlanet) {
            _planet.isHomePlanet = true;
            _planet.owner = msg.sender;
            _planet.population = 50000;
        } else {
            _planet.spaceJunk = LibGameUtils.getPlanetDefaultSpaceJunk(_planet);

            if (LibGameUtils.isHalfSpaceJunk(args.location)) {
                _planet.spaceJunk /= 2;
            }
        }
    }

    function upgradePlanet(uint256 _location, uint256 _branch) public {
        Planet storage planet = gs().planets[_location];
        require(
            planet.owner == msg.sender,
            "Only owner account can perform that operation on planet."
        );
        uint256 planetLevel = planet.planetLevel;
        require(planetLevel > 0, "Planet level is not high enough for this upgrade");
        require(_branch < 3, "Upgrade branch not valid");
        require(planet.planetType == PlanetType.PLANET, "Can only upgrade regular planets");
        require(!planet.destroyed, "planet is destroyed");
        require(!planet.frozen, "planet is frozen");

        uint256 totalLevel = planet.upgradeState0 + planet.upgradeState1 + planet.upgradeState2;
        require(
            (planet.spaceType == SpaceType.NEBULA && totalLevel < 3) ||
                (planet.spaceType == SpaceType.SPACE && totalLevel < 4) ||
                (planet.spaceType == SpaceType.DEEP_SPACE && totalLevel < 5) ||
                (planet.spaceType == SpaceType.DEAD_SPACE && totalLevel < 5),
            "Planet at max total level"
        );

        uint256 upgradeBranchCurrentLevel;
        if (_branch == uint256(UpgradeBranch.DEFENSE)) {
            upgradeBranchCurrentLevel = planet.upgradeState0;
        } else if (_branch == uint256(UpgradeBranch.RANGE)) {
            upgradeBranchCurrentLevel = planet.upgradeState1;
        } else if (_branch == uint256(UpgradeBranch.SPEED)) {
            upgradeBranchCurrentLevel = planet.upgradeState2;
        }
        require(upgradeBranchCurrentLevel < 4, "Upgrade branch already maxed");

        Upgrade memory upgrade = LibStorage.upgrades()[_branch][upgradeBranchCurrentLevel];
        uint256 upgradeCost = (planet.silverCap * 20 * (totalLevel + 1)) / 100;
        require(planet.silver >= upgradeCost, "Insufficient silver to upgrade");

        // do upgrade
        LibGameUtils._buffPlanet(_location, upgrade);
        planet.silver -= upgradeCost;
        if (_branch == uint256(UpgradeBranch.DEFENSE)) {
            planet.upgradeState0 += 1;
        } else if (_branch == uint256(UpgradeBranch.RANGE)) {
            planet.upgradeState1 += 1;
        } else if (_branch == uint256(UpgradeBranch.SPEED)) {
            planet.upgradeState2 += 1;
        }
        emit PlanetUpgraded(msg.sender, _location, _branch, upgradeBranchCurrentLevel + 1);
    }

    function checkPlayerInit(
        uint256 _location,
        uint256 _perlin,
        uint256 _radius,
        uint256 _distFromOriginSquare
    ) public view returns (bool) {
        require(!gs().players[msg.sender].isInitialized, "Player is already initialized");
        require(_radius <= gs().worldRadius, "Init radius is bigger than the current world radius");
        // require(_radius >= gs().innerRadius, "Init radius is smaller than the current inner radius");
        require(
            _distFromOriginSquare >= gs().innerRadius * gs().innerRadius,
            "Init radius is smaller than the current world radius"
        );

        uint256[5] memory MAX_LEVEL_DIST = gameConstants().MAX_LEVEL_DIST;
        require(_radius >= MAX_LEVEL_DIST[1], "Player can only spawn at the edge of universe");

        SpaceType spaceType = LibGameUtils.spaceTypeFromPerlin(_perlin, _distFromOriginSquare);
        require(spaceType == SpaceType.NEBULA, "Only NEBULA");

        // if (gameConstants().SPAWN_RIM_AREA != 0) {
        //     require(
        //         (_radius**2 * 314) / 100 + gameConstants().SPAWN_RIM_AREA >=
        //             (gs().worldRadius**2 * 314) / 100,
        //         "Player can only spawn at the universe rim"
        //     );
        // }
        require(
            _perlin >= gameConstants().INIT_PERLIN_MIN,
            "Init not allowed in perlin value less than INIT_PERLIN_MIN"
        );
        require(
            _perlin < gameConstants().INIT_PERLIN_MAX,
            "Init not allowed in perlin value greater than or equal to the INIT_PERLIN_MAX"
        );
        return true;
    }

    function getRefreshedPlanet(uint256 location, uint256 timestamp)
        public
        view
        returns (
            Planet memory,
            // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

            uint256[16] memory eventsToRemove,
            uint256[16] memory artifactsToAdd,
            bool shoudDeactiveArtifact
        )
    {
        Planet memory planet = gs().planets[location];

        // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

        // first 16 are event ids to remove
        // last 16 are artifact ids that are new on the planet
        uint256[32] memory updates;

        PlanetEventMetadata[] memory events = gs().planetEvents[location];

        (planet, updates, shoudDeactiveArtifact) = LibLazyUpdate.applyPendingEvents(
            timestamp,
            planet,
            events
        );

        for (uint256 i = 0; i < 16; i++) {
            eventsToRemove[i] = updates[i];
            artifactsToAdd[i] = updates[i + 16];
        }

        for (uint256 i = 0; i < artifactsToAdd.length; i++) {
            Artifact memory artifact = gs().artifacts[artifactsToAdd[i]];

            planet = applySpaceshipArrive(artifact, planet);
        }

        planet = LibLazyUpdate.updatePlanet(timestamp, planet);

        return (planet, eventsToRemove, artifactsToAdd, shoudDeactiveArtifact);
    }

    function applySpaceshipArrive(Artifact memory artifact, Planet memory planet)
        public
        pure
        returns (Planet memory)
    {
        if (planet.isHomePlanet) {
            return planet;
        }

        if (artifact.artifactType == ArtifactType.ShipMothership) {
            if (planet.energyGroDoublers == 0) {
                planet.populationGrowth *= 2;
            }
            planet.energyGroDoublers++;
        } else if (artifact.artifactType == ArtifactType.ShipWhale) {
            if (planet.silverGroDoublers == 0) {
                planet.silverGrowth *= 2;
            }
            planet.silverGroDoublers++;
        } else if (artifact.artifactType == ArtifactType.ShipTitan) {
            planet.pausers++;
        }

        return planet;
    }

    function refreshPlanet(uint256 location) public {
        require(gs().planets[location].isInitialized, "Planet has not been initialized");

        (
            Planet memory planet,
            // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

            uint256[16] memory eventsToRemove,
            uint256[16] memory artifactIdsToAddToPlanet,
            bool shouldDeactiveArtifact
        ) = getRefreshedPlanet(location, block.timestamp);

        if (shouldDeactiveArtifact) {
            LibArtifactUtils.deactivateArtifactWithoutCheckOwner(planet.locationId);
        }

        _logCapture(location, planet.owner);

        gs().planets[location] = planet;

        PlanetEventMetadata[] storage events = gs().planetEvents[location];

        // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

        for (uint256 toRemoveIdx = 0; toRemoveIdx < 16; toRemoveIdx++) {
            for (uint256 i = 0; i < events.length; i++) {
                if (events[i].id == eventsToRemove[toRemoveIdx]) {
                    events[i] = events[events.length - 1];
                    events.pop();
                }
            }
        }
        // NOTE: when change gameConstants().MAX_RECEIVING_PLANET also need to change here

        for (uint256 i = 0; i < 16; i++) {
            if (artifactIdsToAddToPlanet[i] != 0) {
                gs().artifactIdToVoyageId[artifactIdsToAddToPlanet[i]] = 0;
                LibGameUtils._putArtifactOnPlanet(artifactIdsToAddToPlanet[i], location);
            }
        }
    }

    function withdrawSilver(uint256 locationId, uint256 silverToWithdraw) public {
        Planet storage planet = gs().planets[locationId];
        require(planet.owner == msg.sender, "you must own this planet");
        require(
            planet.planetType == PlanetType.TRADING_POST,
            "can only withdraw silver from trading posts"
        );
        require(!planet.destroyed, "planet is destroyed");
        require(!planet.frozen, "planet is frozen");

        require(
            planet.silver >= silverToWithdraw,
            "tried to withdraw more silver than exists on planet"
        );

        require(planet.silverCap <= silverToWithdraw * 5, "amount >= 0.2 * silverCap");

        planet.silver -= silverToWithdraw;
        gs().players[msg.sender].silver += silverToWithdraw;

        // Energy and Silver are not stored as floats in the smart contracts,
        // so any of those values coming from the contracts need to be divided by
        // `CONTRACT_PRECISION` to get their true integer value.
        uint256 scoreGained = silverToWithdraw / 1000;
        scoreGained = (scoreGained * gameConstants().SILVER_SCORE_VALUE) / 100;
        gs().players[msg.sender].score += scoreGained;
    }

    function _logCapture(uint256 locationId, address newOwner) internal {
        LogStorage storage ls = LibStorage.analysisStorage();
        address oldOwner = gs().planets[locationId].owner;
        uint256 planetLevel = gs().planets[locationId].planetLevel;
        if (planetLevel < 3 || planetLevel > 9 || oldOwner == newOwner) {
            return;
        }
        // update planet count per level and if first time capturing this level, log it
        if (oldOwner != address(0)) {
            ls.playerLog[oldOwner].planetCntPerLevel[planetLevel]--;
            ls.playerLog[oldOwner].captureLogs.push(
                CaptureLog({
                    timestamp: uint64(block.timestamp),
                    level: uint8(planetLevel),
                    lost: true
                })
            );
        }

        ls.playerLog[newOwner].planetCntPerLevel[planetLevel]++;
        ls.playerLog[newOwner].captureLogs.push(
            CaptureLog({timestamp: uint64(block.timestamp), level: uint8(planetLevel), lost: false})
        );
    }

    function setQusarLootSilver(uint256 locationId, uint256 silverAmount) external {
        Planet storage planet = gs().planets[locationId];
        require(planet.owner == msg.sender, "you must own this planet");
        require(planet.planetType == PlanetType.SILVER_BANK, "only quasar");
        require(!planet.destroyed, "planet is destoryed");
        require(!planet.frozen, "planet is frozen");
        require(silverAmount <= planet.lootSilver + planet.silver, "silve is not enough");

        if (planet.lootOwner != address(0)) {
            gs().players[planet.lootOwner].lootSilver -= planet.lootSilver;
        }

        gs().players[msg.sender].lootSilver += silverAmount;
        planet.lootOwner = msg.sender;
        planet.silver = planet.lootSilver + planet.silver - silverAmount;
        planet.lootSilver = silverAmount;
    }
}
