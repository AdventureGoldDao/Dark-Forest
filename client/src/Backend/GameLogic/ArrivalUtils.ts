import { CONTRACT_PRECISION } from '@dfares/constants';
import { hasOwner, isActivated, isEmojiFlagMessage } from '@dfares/gamelogic';
import {
  ArrivalType,
  Artifact,
  ArtifactType,
  EmojiFlagBody,
  Planet,
  PlanetMessage,
  PlanetType,
  QueuedArrival,
  Upgrade,
} from '@dfares/types';
import _ from 'lodash';
import { ContractConstants } from '../../_types/darkforest/api/ContractsAPITypes';

// TODO: planet class, cmon, let's go
export const blocksLeftToProspectExpiration = (
  currentBlockNumber: number,
  prospectedBlockNumber?: number
) => {
  return (prospectedBlockNumber || 0) + 255 - currentBlockNumber;
};

// TODO: Planet. Class.
export const prospectExpired = (currentBlockNumber: number, prospectedBlockNumber: number) => {
  return blocksLeftToProspectExpiration(currentBlockNumber, prospectedBlockNumber) <= 0;
};

export const isFindable = (planet: Planet, currentBlockNumber?: number): boolean => {
  return (
    currentBlockNumber !== undefined &&
    planet.planetType === PlanetType.RUINS &&
    planet.prospectedBlockNumber !== undefined &&
    !planet.hasTriedFindingArtifact &&
    !prospectExpired(currentBlockNumber, planet.prospectedBlockNumber)
  );
};

export const isProspectable = (planet: Planet): boolean => {
  return planet.planetType === PlanetType.RUINS && planet.prospectedBlockNumber === undefined;
};

const getSilverOverTime = (
  planet: Planet,
  startTimeMillis: number,
  endTimeMillis: number
): number => {
  if (!hasOwner(planet)) {
    return planet.silver;
  }

  if (planet.silver > planet.silverCap - planet.lootSilver) {
    return planet.silverCap - planet.lootSilver;
  }
  const timeElapsed = endTimeMillis / 1000 - startTimeMillis / 1000;

  return Math.min(
    timeElapsed * planet.silverGrowth + planet.silver,
    planet.silverCap - planet.lootSilver
  );
};

export const getEnergyAtTime = (planet: Planet, atTimeMillis: number): number => {
  if (planet.energy === 0) {
    return 0;
  }
  if (!hasOwner(planet)) {
    return planet.energy;
  }

  if (planet.planetType === PlanetType.SILVER_BANK) {
    if (planet.energy > planet.energyCap) {
      return planet.energyCap;
    }
  }

  const timeElapsed = atTimeMillis / 1000 - planet.lastUpdated;
  const denominator =
    Math.exp((-4 * planet.energyGrowth * timeElapsed) / planet.energyCap) *
      (planet.energyCap / planet.energy - 1) +
    1;
  return planet.energyCap / denominator;
};

export const updatePlanetToTime = (
  planet: Planet,
  planetArtifacts: Artifact[],
  atTimeMillis: number,
  contractConstants: ContractConstants,
  setPlanet: (p: Planet) => void = () => {}
): void => {
  if (atTimeMillis < planet.lastUpdated * 1000) {
    return;
  }

  if (planet.pausers === 0) {
    planet.silver = getSilverOverTime(planet, planet.lastUpdated * 1000, atTimeMillis);
    planet.energy = getEnergyAtTime(planet, atTimeMillis);
  }

  planet.lastUpdated = atTimeMillis / 1000;

  const photoidActivationTime = contractConstants.PHOTOID_ACTIVATION_DELAY * 1000;
  const activePhotoid = planetArtifacts.find(
    (a) =>
      a.artifactType === ArtifactType.PhotoidCannon &&
      isActivated(a) &&
      atTimeMillis - a.lastActivated * 1000 >= photoidActivationTime
  );

  if (activePhotoid && !planet.localPhotoidUpgrade) {
    planet.localPhotoidUpgrade = activePhotoid.timeDelayedUpgrade;
    applyUpgrade(planet, activePhotoid.timeDelayedUpgrade);
  }

  setPlanet(planet);
};

export const applyUpgrade = (planet: Planet, upgrade: Upgrade, unApply = false) => {
  if (unApply) {
    planet.speed /= upgrade.energyCapMultiplier / 100;
    planet.energyGrowth /= upgrade.energyGroMultiplier / 100;
    planet.range /= upgrade.rangeMultiplier / 100;
    planet.speed /= upgrade.speedMultiplier / 100;
    planet.defense /= upgrade.defMultiplier / 100;
  } else {
    planet.speed *= upgrade.energyCapMultiplier / 100;
    planet.energyGrowth *= upgrade.energyGroMultiplier / 100;
    planet.range *= upgrade.rangeMultiplier / 100;
    planet.speed *= upgrade.speedMultiplier / 100;
    planet.defense *= upgrade.defMultiplier / 100;
  }
};

/**
 * @param previous The previously calculated state of a planet
 * @param current The current calculated state of the planet
 * @param arrival The Arrival that caused the state change
 */
export interface PlanetDiff {
  previous: Planet;
  current: Planet;
  arrival: QueuedArrival;
}

export const arrive = (
  toPlanet: Planet,
  artifactsOnPlanet: Artifact[],
  arrival: QueuedArrival,
  arrivingArtifact: Artifact | undefined,
  contractConstants: ContractConstants
): PlanetDiff => {
  // this function optimistically simulates an arrival
  if (toPlanet.locationId !== arrival.toPlanet) {
    throw new Error(`attempted to apply arrival for wrong toPlanet ${toPlanet.locationId}`);
  }

  // update toPlanet energy and silver right before arrival
  updatePlanetToTime(toPlanet, artifactsOnPlanet, arrival.arrivalTime * 1000, contractConstants);

  const prevPlanet = _.cloneDeep(toPlanet);

  // if (toPlanet.destroyed || toPlanet.frozen) {
  //   return { arrival: arrival, previous: toPlanet, current: toPlanet };
  // }

  // apply energy
  const { energyArriving, arrivalTime, members } = arrival;

  let inUnion = false;
  for (let i = 0; i < members.length; i++) {
    if (members[i].toLowerCase() === toPlanet.owner) {
      inUnion = true;
      break;
    }
  }

  const activeArtifact = artifactsOnPlanet.find((a) => a.lastActivated > a.lastDeactivated);
  if (arrival.player === toPlanet.owner || (arrival.unionId !== 0 && inUnion)) {
    // moving between my own planets or between union members
    toPlanet.energy += energyArriving;
  } else {
    if (arrival.arrivalType === ArrivalType.Wormhole) {
      // if this is a wormhole arrival to a planet that isn't owned by the initiator of
      // the move, then don't move any energy
    }
    // attacking enemy - includes emptyAddress
    else if (
      arrival.arrivalType === ArrivalType.Photoid &&
      activeArtifact?.artifactType === ArtifactType.StellarShield &&
      arrivalTime >= activeArtifact.lastActivated + contractConstants.STELLAR_ACTIVATION_DELAY
    ) {
      //stellar shield successfully blocks an attack
      //then deactivated the shield
      // console.log(
      //   toPlanet,
      //   artifactsOnPlanet,
      //   arrival,
      //   arrivingArtifact,
      //   contractConstants,
      //   contractConstants
      // );
      toPlanet.heldArtifactIds = toPlanet.heldArtifactIds.filter((id) => id !== activeArtifact.id);
    } else if (
      toPlanet.energy >
      Math.floor((energyArriving * CONTRACT_PRECISION * 100) / toPlanet.defense) /
        CONTRACT_PRECISION
    ) {
      // attack reduces target planet's garrison but doesn't conquer it
      toPlanet.energy -=
        Math.floor((energyArriving * CONTRACT_PRECISION * 100) / toPlanet.defense) /
        CONTRACT_PRECISION;
    } else {
      // conquers planet
      toPlanet.owner = arrival.player;
      toPlanet.energy =
        energyArriving -
        Math.floor((toPlanet.energy * CONTRACT_PRECISION * toPlanet.defense) / 100) /
          CONTRACT_PRECISION;
    }
  }

  if (toPlanet.planetType === PlanetType.SILVER_BANK || toPlanet.pausers !== 0) {
    if (toPlanet.energy > toPlanet.energyCap) {
      toPlanet.energy = toPlanet.energyCap;
    }
  }

  // apply silver
  if (toPlanet.silver + arrival.silverMoved > toPlanet.silverCap - toPlanet.lootSilver) {
    toPlanet.silver = toPlanet.silverCap - toPlanet.lootSilver;
  } else {
    toPlanet.silver += arrival.silverMoved;
  }

  // transfer artifact if necessary
  if (arrival.artifactId) {
    toPlanet.heldArtifactIds.push(arrival.artifactId);
  }

  if (arrivingArtifact) {
    if (arrivingArtifact.artifactType === ArtifactType.ShipMothership) {
      if (toPlanet.energyGroDoublers === 0) {
        toPlanet.energyGrowth *= 2;
      }
      toPlanet.energyGroDoublers++;
    } else if (arrivingArtifact.artifactType === ArtifactType.ShipWhale) {
      if (toPlanet.silverGroDoublers === 0) {
        toPlanet.silverGrowth *= 2;
      }
      toPlanet.silverGroDoublers++;
    } else if (arrivingArtifact.artifactType === ArtifactType.ShipTitan) {
      toPlanet.pausers++;
    }
    arrivingArtifact.onPlanetId = toPlanet.locationId;
  }

  return { arrival, current: toPlanet, previous: prevPlanet };
};

/**
 * @todo ArrivalUtils has become a dumping ground for functions that should just live inside of a
 * `Planet` class.
 */
export function getEmojiMessage(
  planet: Planet | undefined
): PlanetMessage<EmojiFlagBody> | undefined {
  return planet?.messages?.find(isEmojiFlagMessage);
}
