import {
  Artifact,
  ArtifactId,
  BurnedCoords,
  ClaimedCoords,
  KardashevCoords,
  LocationId,
  Planet,
  Player,
  QueuedArrival,
  RevealedCoords,
  Union,
  UnionId,
  VoyageId,
} from '@dfares/types';
import _ from 'lodash';
import React from 'react';
import { Link } from '../../Frontend/Components/CoreUI';
import { LoadingBarHandle } from '../../Frontend/Components/TextLoadingBar';
import { DarkForestTips } from '../../Frontend/Views/DarkForestTips';
import { TerminalHandle } from '../../Frontend/Views/Terminal';
import { ContractConstants } from '../../_types/darkforest/api/ContractsAPITypes';
import { AddressTwitterMap } from '../../_types/darkforest/api/UtilityServerAPITypes';
import { tryGetAllTwitters } from '../Network/UtilityServerAPI';
import PersistentChunkStore from '../Storage/PersistentChunkStore';
import { ContractsAPI } from './ContractsAPI';

export interface InitialGameState {
  contractConstants: ContractConstants;
  players: Map<string, Player>;
  unions: Map<UnionId, Union>;
  worldRadius: number;
  innerRadius: number;
  allTouchedPlanetIds: LocationId[];
  allRevealedCoords: RevealedCoords[];
  allClaimedCoords: ClaimedCoords[];
  allBurnedCoords: BurnedCoords[];
  allKardashevCoords: KardashevCoords[];
  pendingMoves: QueuedArrival[];
  touchedAndLocatedPlanets: Map<LocationId, Planet>;
  artifactsOnVoyages: Artifact[];
  myArtifacts: Artifact[];
  heldArtifacts: Artifact[][];
  loadedPlanets: LocationId[];
  revealedCoordsMap: Map<LocationId, RevealedCoords>;
  claimedCoordsMap: Map<LocationId, ClaimedCoords>;
  burnedCoordsMap: Map<LocationId, BurnedCoords>;
  kardashevCoordsMap: Map<LocationId, KardashevCoords>;
  planetVoyageIdMap: Map<LocationId, VoyageId[]>;
  arrivals: Map<VoyageId, QueuedArrival>;
  twitters: AddressTwitterMap;
  paused: boolean;
  halfPrice: boolean;
}

export class InitialGameStateDownloader {
  private terminal: TerminalHandle;

  public constructor(terminal: TerminalHandle) {
    this.terminal = terminal;
  }

  private makeProgressListener(prettyEntityName: string) {
    const ref = React.createRef<LoadingBarHandle>();
    this.terminal.printLoadingBar(prettyEntityName, ref);
    this.terminal.newline();

    return (percent: number) => {
      ref.current?.setFractionCompleted(percent);
    };
  }

  async download(
    contractsAPI: ContractsAPI,
    persistentChunkStore: PersistentChunkStore
  ): Promise<InitialGameState> {
    const isDev = process.env.NODE_ENV !== 'production';

    /**
     * In development we use the same contract address every time we deploy,
     * so storage is polluted with the IDs of old universes.
     */
    const storedTouchedPlanetIds = isDev
      ? []
      : await persistentChunkStore.getSavedTouchedPlanetIds();
    const storedRevealedCoords = isDev ? [] : await persistentChunkStore.getSavedRevealedCoords();
    const storedClaimedCoords = await persistentChunkStore.getSavedClaimedCoords();
    const storedBurnedCoords = await persistentChunkStore.getSavedBurnedCoords();
    const storedKardashevCoords = await persistentChunkStore.getSavedKardashevCoords();

    this.terminal.printElement(<DarkForestTips tips={tips} />);
    this.terminal.newline();

    const planetIdsLoadingBar = this.makeProgressListener('Planet IDs');
    const playersLoadingBar = this.makeProgressListener('Players');
    const unionsLoadingBar = this.makeProgressListener('Unions');
    const revealedPlanetsLoadingBar = this.makeProgressListener('Revealed Planet IDs');
    const revealedPlanetsCoordsLoadingBar = this.makeProgressListener(
      'Revealed Planet Coordinates'
    );
    const claimedPlanetsLoadingBar = this.makeProgressListener('Claimed Planet IDs');
    const claimedPlanetsCoordsLoadingBar = this.makeProgressListener('Claimed Planet Coordinates');
    // const burnedPlanetsLoadingBar = this.makeProgressListener('Burned Planet IDs');
    // const burnedPlanetsCoordsLoadingBar = this.makeProgressListener('Burned Planet Coordinates');
    // const kardashevPlanetsLoadingBar = this.makeProgressListener('Kardashev Planet IDs');
    // const kardashevPlanetsCoordsLoadingBar = this.makeProgressListener(
    //   'Kardashev Planet Coordinates'
    // );

    const pendingMovesLoadingBar = this.makeProgressListener('Pending Moves');
    const planetsLoadingBar = this.makeProgressListener('Planets');
    const artifactsOnPlanetsLoadingBar = this.makeProgressListener('Artifacts On Planets');
    const artifactsInFlightLoadingBar = this.makeProgressListener('Artifacts On Moves');
    const yourArtifactsLoadingBar = this.makeProgressListener('Your Artifacts');

    const contractConstants = contractsAPI.getConstants();
    const worldRadius = contractsAPI.getWorldRadius();
    const innerRadius = contractsAPI.getInnerRadius();

    const players = contractsAPI.getPlayers(playersLoadingBar);
    const unions = contractsAPI.getUnions(unionsLoadingBar);

    const arrivals: Map<VoyageId, QueuedArrival> = new Map();
    const planetVoyageIdMap: Map<LocationId, VoyageId[]> = new Map();

    const minedChunks = Array.from(await persistentChunkStore.allChunks());
    const minedPlanetIds = new Set(
      _.flatMap(minedChunks, (c) => c.planetLocations).map((l) => l.hash)
    );

    const loadedTouchedPlanetIds = contractsAPI.getTouchedPlanetIds(
      storedTouchedPlanetIds.length,
      planetIdsLoadingBar
    );

    const loadedRevealedCoords = contractsAPI.getRevealedPlanetsCoords(
      storedRevealedCoords.length,
      revealedPlanetsLoadingBar,
      revealedPlanetsCoordsLoadingBar
    );
    const loadedClaimedCoords = contractsAPI.getClaimedPlanetsCoords(
      0,
      claimedPlanetsLoadingBar,
      claimedPlanetsCoordsLoadingBar
    );

    // const loadedBurnedCoords = contractsAPI.getBurnedPlanetsCoords(
    //   0,
    //   burnedPlanetsLoadingBar,
    //   burnedPlanetsCoordsLoadingBar
    // );

    // const loadedKardashevCoords = contractsAPI.getKardashevPlanetsCoords(
    //   0,
    //   kardashevPlanetsLoadingBar,
    //   kardashevPlanetsCoordsLoadingBar
    // );
    const allTouchedPlanetIds = storedTouchedPlanetIds.concat(await loadedTouchedPlanetIds);
    const allRevealedCoords = storedRevealedCoords.concat(await loadedRevealedCoords);
    const allClaimedCoords = storedClaimedCoords.concat(await loadedClaimedCoords);
    const allBurnedCoords = storedBurnedCoords; //.concat(await loadedBurnedCoords);
    const allKardashevCoords = storedKardashevCoords; //.concat(await loadedKardashevCoords);

    const revealedCoordsMap = new Map<LocationId, RevealedCoords>();
    for (const revealedCoords of allRevealedCoords) {
      revealedCoordsMap.set(revealedCoords.hash, revealedCoords);
    }

    const claimedCoordsMap = new Map<LocationId, ClaimedCoords>();
    for (const claimedCoords of allClaimedCoords) {
      claimedCoordsMap.set(claimedCoords.hash, claimedCoords);
    }

    const burnedCoordsMap = new Map<LocationId, BurnedCoords>();
    for (const burnedCoords of allBurnedCoords) {
      burnedCoordsMap.set(burnedCoords.hash, burnedCoords);
    }

    const kardashevCoordsMap = new Map<LocationId, KardashevCoords>();
    for (const kardashevCoords of allKardashevCoords) {
      kardashevCoordsMap.set(kardashevCoords.hash, kardashevCoords);
    }
    let planetsToLoad = allTouchedPlanetIds.filter(
      (id) =>
        minedPlanetIds.has(id) ||
        revealedCoordsMap.has(id) ||
        claimedCoordsMap.has(id) ||
        burnedCoordsMap.has(id) ||
        kardashevCoordsMap.has(id)
    );

    const pendingMoves = await contractsAPI.getAllArrivals(planetsToLoad, pendingMovesLoadingBar);

    // add origin points of voyages to known planets, because we need to know origin owner to render
    // the shrinking / incoming circle
    for (const arrival of pendingMoves) {
      planetsToLoad.push(arrival.fromPlanet);
    }
    planetsToLoad = [...new Set(planetsToLoad)];

    const touchedAndLocatedPlanets = await contractsAPI.bulkGetPlanets(
      planetsToLoad,
      planetsLoadingBar
    );

    touchedAndLocatedPlanets.forEach((_planet, locId) => {
      if (touchedAndLocatedPlanets.has(locId)) {
        planetVoyageIdMap.set(locId, []);
      }
    });

    for (const arrival of pendingMoves) {
      const voyageIds = planetVoyageIdMap.get(arrival.toPlanet);
      if (voyageIds) {
        voyageIds.push(arrival.eventId);
        planetVoyageIdMap.set(arrival.toPlanet, voyageIds);
      }
      arrivals.set(arrival.eventId, arrival);
    }

    const artifactIdsOnVoyages: ArtifactId[] = [];
    for (const arrival of pendingMoves) {
      if (arrival.artifactId) {
        artifactIdsOnVoyages.push(arrival.artifactId);
      }
    }

    const artifactsOnVoyages = await contractsAPI.bulkGetArtifacts(
      artifactIdsOnVoyages,
      artifactsInFlightLoadingBar
    );

    const heldArtifacts = contractsAPI.bulkGetArtifactsOnPlanets(
      planetsToLoad,
      artifactsOnPlanetsLoadingBar
    );
    const myArtifacts = contractsAPI.getPlayerArtifacts(
      contractsAPI.getAddress(),
      yourArtifactsLoadingBar
    );

    const twitters = await tryGetAllTwitters();
    const paused = contractsAPI.getIsPaused();
    const halfPrice = contractsAPI.getIsHalfPrice();

    const initialState: InitialGameState = {
      contractConstants: await contractConstants,
      players: await players,
      unions: await unions,
      worldRadius: await worldRadius,
      innerRadius: await innerRadius,
      allTouchedPlanetIds,
      allRevealedCoords,
      allClaimedCoords,
      allBurnedCoords,
      allKardashevCoords,
      pendingMoves,
      touchedAndLocatedPlanets,
      artifactsOnVoyages,
      myArtifacts: await myArtifacts,
      heldArtifacts: await heldArtifacts,
      loadedPlanets: planetsToLoad,
      revealedCoordsMap,
      claimedCoordsMap,
      burnedCoordsMap,
      kardashevCoordsMap,
      planetVoyageIdMap,
      arrivals,
      twitters,
      paused: await paused,
      halfPrice: await halfPrice,
    };

    return initialState;
  }
}

const tips = [
  'Beware of pirates! To capture a planet with pirates, simply send an attack large enough to overcome its current energy.',
  <>
    Navigate the Dark Forest Adventure with allies (and enemies) - join the{' '}
    <Link to='https://discord.com/invite/f3FrFA4T25'>DFArchon Discord</Link>!
    <br />
    <br />
    Dark Forest Adventure is a modified version of classic{' '}
    <Link to='https://zkga.me/'>Dark Forest</Link>
    .
    <br />
    DFArchon is a dev team focused on fully onchain games.
  </>,
  'There are many different artifact types, each with unique properties... try activating one on a planet!',
  'The top players get special rewards at the end of each DFAres v0.1 round!',
  "There are many different ways to enjoy Dark Forest Adventure - as long as you're having fun, you're doing it right.",
  'Be careful when capturing planets - if you attack a player-owned planet, it may look like an act of war!',
  'A planet can have at most one active artifact.',
  'Withdrawing an artifact (via a Spacetime Rip) gives you full control of that artifact as an ERC 721 token. You can deposit artifacts you have withdrawn back into the universe via Spacetime Rips.',
  'You can use plugins to enhance your capabilities by automating repetitive tasks. The top players are probably using plugins (:',
  'Quasars can store lots of energy and silver, at the expense of being able to generate neither.',
  'Never share your private key with anyone else!',
  'Broadcasting a planet reveals its location to ALL other players!',
  'Claiming a planet reveals its location to ALL other players!',
  'You can spend silver to upgrade your planets.',
  'Planets in Nebula are more difficult to capture than planets in Deep Space.',
  'Some of the universe is corrupted, and contains special versions of the artifacts.',
  'You can import and export maps! Be careful importing maps from others, they may contain fabricated map data.',
  <>
    If mining the universe is slow on your computer, you can try the Remote Miner plugin. Find that
    and other plugins on{' '}
    <Link to='https://dfares-plugins.netlify.app/'>dfares-plugins.netlify.app</Link>.
  </>,
  "A planet can only have 6 artifacts on it at any given time. Sometimes more if you get lucky. It's the blockchain, after all.",
  'A foundry must be prospected before you can attempt to find an artifact, but make sure to click "Find" before 256 blocks or it will be lost forever.',
  'Defense upgrades make your planets less vulnerable to attack, Range upgrades make your voyages go further and decay less, and Speed upgrades make your voyages go much faster.',
  'Wormhole artifacts reduce the effective distance between 2 planets. Try using them to link 2 planets very far apart!',
  'Upon deactivation, some artifacts must cooldown for a period before they can be activated again.',
  'Photoid Cannon artifacts will debuff your planet on activation, but get a massive stat boost for the first voyage from the planet after that a charging period. Photoid Cannon artifacts are destroyed upon use.',
  "Planetary Shield artifacts will massively boost a planet's defense, but at the cost of energy and energy growth stats. Planetary Shield artifacts are destroyed upon deactivation.",
  "Bloom Filter artifacts instantly set a planet's energy and silver to full, but are destroyed upon activation. Try using them on a Quasar!",
  'Dark Forest Adventure exists on the blockchain, so you can play with an entirely different client if you want.',
  <>
    Writing plugins? Check out some documentation{' '}
    <Link to='https://github.com/dfarchon/DFARES-v0.1/blob/main/client/docs/classes/Backend_GameLogic_GameManager.default.md'>
      here
    </Link>{' '}
    and{' '}
    <Link to='https://github.com/dfarchon/DFARES-v0.1/blob/main/client/docs/classes/Backend_GameLogic_GameUIManager.default.md'>
      here
    </Link>
    .
  </>,
];
