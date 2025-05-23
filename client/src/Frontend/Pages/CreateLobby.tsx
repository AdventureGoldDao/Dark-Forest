import { INIT_ADDRESS } from '@dfares/contracts';
// This is loaded as URL paths by a webpack loader
import initContractAbiUrl from '@dfares/contracts/abis/DFInitialize.json';
import { EthConnection } from '@dfares/network';
import { address } from '@dfares/serde';
import { ArtifactRarity, EthAddress, UnconfirmedCreateLobby } from '@dfares/types';
import { Contract } from 'ethers';
import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { ContractsAPI, makeContractsAPI } from '../../Backend/GameLogic/ContractsAPI';
import { ContractsAPIEvent } from '../../_types/darkforest/api/ContractsAPITypes';
import { InitRenderState, Wrapper } from '../Components/GameLandingPageComponents';
import { ConfigurationPane } from '../Panes/Lobbies/ConfigurationPane';
import { Minimap } from '../Panes/Lobbies/MinimapPane';
import { MinimapConfig } from '../Panes/Lobbies/MinimapUtils';
import { LobbyInitializers } from '../Panes/Lobbies/Reducer';
import { listenForKeyboardEvents, unlinkKeyboardEvents } from '../Utils/KeyEmitters';
import { CadetWormhole } from '../Views/CadetWormhole';
import { LobbyLandingPage } from './LobbyLandingPage';

type ErrorState =
  | { type: 'invalidAddress' }
  | { type: 'contractLoad' }
  | { type: 'invalidContract' }
  | { type: 'invalidCreate' };

export function CreateLobby({ match }: RouteComponentProps<{ contract: string }>) {
  const [connection, setConnection] = useState<EthConnection | undefined>();
  const [ownerAddress, setOwnerAddress] = useState<EthAddress | undefined>();
  const [contract, setContract] = useState<ContractsAPI | undefined>();
  const [startingConfig, setStartingConfig] = useState<LobbyInitializers | undefined>();
  const [lobbyAddress, setLobbyAddress] = useState<EthAddress | undefined>();
  const [minimapConfig, setMinimapConfig] = useState<MinimapConfig | undefined>();

  const onMapChange = useMemo(() => {
    return _.debounce((config: MinimapConfig) => setMinimapConfig(config), 500);
  }, [setMinimapConfig]);

  let contractAddress: EthAddress | undefined;
  try {
    contractAddress = address(match.params.contract);
  } catch (err) {
    console.error('Invalid address', err);
  }

  const [errorState, setErrorState] = useState<ErrorState | undefined>(
    contractAddress ? undefined : { type: 'invalidAddress' }
  );

  useEffect(() => {
    listenForKeyboardEvents();

    return () => unlinkKeyboardEvents();
  }, []);

  const onReady = useCallback(
    (connection: EthConnection) => {
      setConnection(connection);
      setOwnerAddress(connection.getAddress());
    },
    [setConnection]
  );

  useEffect(() => {
    if (connection && contractAddress) {
      makeContractsAPI({ connection, contractAddress })
        .then((contract) => setContract(contract))
        .catch((e) => {
          console.log(e);
          setErrorState({ type: 'contractLoad' });
        });
    }
  }, [connection, contractAddress]);

  useEffect(() => {
    if (contract) {
      contract
        .getConstants()
        .then((config) => {
          setStartingConfig({
            // Explicitly defaulting this to false
            WHITELIST_ENABLED: false,
            // TODO: Figure out if we should expose this from contract
            START_PAUSED: false,
            ADMIN_CAN_ADD_PLANETS: config.ADMIN_CAN_ADD_PLANETS,
            WORLD_RADIUS_LOCKED: config.WORLD_RADIUS_LOCKED,
            WORLD_RADIUS_MIN: config.WORLD_RADIUS_MIN,
            DISABLE_ZK_CHECKS: config.DISABLE_ZK_CHECKS,
            PLANETHASH_KEY: config.PLANETHASH_KEY,
            SPACETYPE_KEY: config.SPACETYPE_KEY,
            BIOMEBASE_KEY: config.BIOMEBASE_KEY,
            PERLIN_MIRROR_X: config.PERLIN_MIRROR_X,
            PERLIN_MIRROR_Y: config.PERLIN_MIRROR_Y,
            PERLIN_LENGTH_SCALE: config.PERLIN_LENGTH_SCALE,
            MAX_NATURAL_PLANET_LEVEL: config.MAX_NATURAL_PLANET_LEVEL,
            MAX_ARTIFACT_PER_PLANET: config.MAX_ARTIFACT_PER_PLANET,
            MAX_SENDING_PLANET: config.MAX_SENDING_PLANET,
            MAX_RECEIVING_PLANET: config.MAX_RECEIVING_PLANET,
            TIME_FACTOR_HUNDREDTHS: config.TIME_FACTOR_HUNDREDTHS,
            PERLIN_THRESHOLD_1: config.PERLIN_THRESHOLD_1,
            PERLIN_THRESHOLD_2: config.PERLIN_THRESHOLD_2,
            PERLIN_THRESHOLD_3: config.PERLIN_THRESHOLD_3,
            INIT_PERLIN_MIN: config.INIT_PERLIN_MIN,
            INIT_PERLIN_MAX: config.INIT_PERLIN_MAX,
            SPAWN_RIM_AREA: config.SPAWN_RIM_AREA,
            BIOME_THRESHOLD_1: config.BIOME_THRESHOLD_1,
            BIOME_THRESHOLD_2: config.BIOME_THRESHOLD_2,
            PLANET_LEVEL_THRESHOLDS: config.PLANET_LEVEL_THRESHOLDS,
            PLANET_RARITY: config.PLANET_RARITY,
            LOCATION_REVEAL_COOLDOWN: config.LOCATION_REVEAL_COOLDOWN,
            // TODO: Need to think through this implementation a bit more, even if only toggling planet types
            PLANET_TYPE_WEIGHTS: config.PLANET_TYPE_WEIGHTS,
            // TODO: Rename in one of the places
            // TODO: Implement... Needs a datetime input component (WIP)
            TOKEN_MINT_END_TIMESTAMP: 1948939200, // new Date("2031-10-05T04:00:00.000Z").getTime() / 1000,
            PHOTOID_ACTIVATION_DELAY: config.PHOTOID_ACTIVATION_DELAY,
            STELLAR_ACTIVATION_DELAY: config.STELLAR_ACTIVATION_DELAY,
            SILVER_SCORE_VALUE: config.SILVER_SCORE_VALUE,
            ARTIFACT_POINT_VALUES: [
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Unknown],
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Common],
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Rare],
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Epic],
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Legendary],
              config.ARTIFACT_POINT_VALUES[ArtifactRarity.Mythic],
            ],
            PLANET_TRANSFER_ENABLED: config.PLANET_TRANSFER_ENABLED,
            SPACE_JUNK_ENABLED: config.SPACE_JUNK_ENABLED,
            SPACE_JUNK_LIMIT: config.SPACE_JUNK_LIMIT,
            PLANET_LEVEL_JUNK: config.PLANET_LEVEL_JUNK,
            ABANDON_SPEED_CHANGE_PERCENT: config.ABANDON_SPEED_CHANGE_PERCENT,
            ABANDON_RANGE_CHANGE_PERCENT: config.ABANDON_RANGE_CHANGE_PERCENT,
            CAPTURE_ZONES_ENABLED: config.CAPTURE_ZONES_ENABLED,
            CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL: config.CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL,
            CAPTURE_ZONE_PLANET_LEVEL_SCORE: config.CAPTURE_ZONE_PLANET_LEVEL_SCORE,
            CAPTURE_ZONE_RADIUS: config.CAPTURE_ZONE_RADIUS,
            CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED: config.CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED,
            CAPTURE_ZONES_PER_5000_WORLD_RADIUS: config.CAPTURE_ZONES_PER_5000_WORLD_RADIUS,
            SPACESHIPS: config.SPACESHIPS,
            ROUND_END_REWARDS_BY_RANK: config.ROUND_END_REWARDS_BY_RANK,
            CLAIM_END_TIMESTAMP: config.CLAIM_END_TIMESTAMP,
            CLAIM_PLANET_COOLDOWN: config.CLAIM_PLANET_COOLDOWN,
            BURN_END_TIMESTAMP: config.BURN_END_TIMESTAMP,
            BURN_PLANET_COOLDOWN: config.BURN_PLANET_COOLDOWN,
            PINK_PLANET_COOLDOWN: config.PINK_PLANET_COOLDOWN,
            ACTIVATE_ARTIFACT_COOLDOWN: config.ACTIVATE_ARTIFACT_COOLDOWN,
            BUY_ARTIFACT_COOLDOWN: config.BUY_ARTIFACT_COOLDOWN,
            BUY_ENERGY_COOLDOWN: config.BUY_ENERGY_COOLDOWN,
            BURN_PLANET_LEVEL_EFFECT_RADIUS: config.BURN_PLANET_LEVEL_EFFECT_RADIUS,
            BURN_PLANET_REQUIRE_SILVER_AMOUNTS: config.BURN_PLANET_LEVEL_EFFECT_RADIUS,

            MAX_LEVEL_DIST: [
              config.MAX_LEVEL_DIST[0],
              config.MAX_LEVEL_DIST[1],
              config.MAX_LEVEL_DIST[2],
              config.MAX_LEVEL_DIST[3],
              config.MAX_LEVEL_DIST[4],
            ],
            MAX_LEVEL_LIMIT: [
              config.MAX_LEVEL_LIMIT[0],
              config.MAX_LEVEL_LIMIT[1],
              config.MAX_LEVEL_LIMIT[2],
              config.MAX_LEVEL_LIMIT[3],
              config.MAX_LEVEL_LIMIT[4],
              config.MAX_LEVEL_LIMIT[5],
            ],
            MIN_LEVEL_BIAS: [
              config.MIN_LEVEL_BIAS[0],
              config.MIN_LEVEL_BIAS[1],
              config.MIN_LEVEL_BIAS[2],
              config.MIN_LEVEL_BIAS[3],
              config.MIN_LEVEL_BIAS[4],
              config.MIN_LEVEL_BIAS[5],
            ],
            ENTRY_FEE: config.ENTRY_FEE,
            KARDASHEV_END_TIMESTAMP: config.KARDASHEV_END_TIMESTAMP,
            KARDASHEV_PLANET_COOLDOWN: config.KARDASHEV_PLANET_COOLDOWN,
            BLUE_PLANET_COOLDOWN: config.BLUE_PLANET_COOLDOWN,
            KARDASHEV_EFFECT_RADIUS: config.KARDASHEV_EFFECT_RADIUS,
            KARDASHEV_REQUIRE_SILVER_AMOUNTS: config.KARDASHEV_REQUIRE_SILVER_AMOUNTS,
            BLUE_PANET_REQUIRE_SILVER_AMOUNTS: config.BLUE_PANET_REQUIRE_SILVER_AMOUNTS,
          });
        })
        .catch((e) => {
          console.log(e);
          setErrorState({ type: 'invalidContract' });
        });
    }
  }, [contract]);

  async function createLobby(config: LobbyInitializers) {
    if (!contract) {
      setErrorState({ type: 'invalidCreate' });
      return;
    }

    const initializers = { ...startingConfig, ...config };

    console.log(initializers);
    const InitABI = await fetch(initContractAbiUrl).then((r) => r.json());
    const artifactBaseURI = '';
    const initInterface = Contract.getInterface(InitABI);
    const initAddress = INIT_ADDRESS;
    const initFunctionCall = initInterface.encodeFunctionData('init', [
      initializers.WHITELIST_ENABLED,
      artifactBaseURI,
      initializers,
    ]);
    const txIntent: UnconfirmedCreateLobby = {
      methodName: 'createLobby',
      contract: contract.contract,
      args: Promise.resolve([initAddress, initFunctionCall]),
    };

    contract.once(ContractsAPIEvent.LobbyCreated, (owner: EthAddress, lobby: EthAddress) => {
      if (owner === ownerAddress) {
        setLobbyAddress(lobby);
      }
    });

    const tx = await contract.submitTransaction(txIntent, {
      // The createLobby function costs somewhere around 12mil gas
      // costs somewhere around 17,574,726
      gasLimit: '20000000', // Redstone Mainnet block limit is 100,000,000
    });
    await tx.confirmedPromise;
  }

  if (errorState) {
    switch (errorState.type) {
      case 'contractLoad':
        return <CadetWormhole imgUrl='/public/img/wrong-text.png' />;
      case 'invalidAddress':
      case 'invalidContract':
        return <CadetWormhole imgUrl='/public/img/no-contract-text.png' />;
      case 'invalidCreate':
        return <CadetWormhole imgUrl='/public/img/wrong-text.png' />;
      default:
        // https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
        const _exhaustive: never = errorState;
        return _exhaustive;
    }
  }
  let content;
  if (startingConfig) {
    content = (
      <>
        <ConfigurationPane
          modalIndex={2}
          lobbyAddress={lobbyAddress}
          startingConfig={startingConfig}
          onMapChange={onMapChange}
          onCreate={createLobby}
        />
        {/* Minimap uses modalIndex=1 so it is always underneath the configuration pane */}
        <Minimap modalIndex={1} config={minimapConfig} />
      </>
    );
  } else {
    content = <LobbyLandingPage onReady={onReady} />;
  }

  return (
    <Wrapper initRender={InitRenderState.NONE} terminalEnabled={false}>
      {content}
    </Wrapper>
  );
}
