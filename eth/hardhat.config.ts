// This file uses a `organize-imports-ignore` comment because we
// need to control the ordering that Hardhat tasks are registered

// organize-imports-ignore

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-abi-exporter';
import 'hardhat-diamond-abi';
// Must be registered after hardhat-diamond-abi
import '@typechain/hardhat';
import 'hardhat-circom';
import 'hardhat-contract-sizer';
import '@solidstate/hardhat-4byte-uploader';
import { extendEnvironment, HardhatUserConfig } from 'hardhat/config';
import { lazyObject } from 'hardhat/plugins';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as diamondUtils from './utils/diamond';
import * as subgraphUtils from './utils/subgraph';
import * as path from 'path';
import * as settings from './settings';
import { decodeContracts, decodeInitializers, decodeAdminPlanets } from '@dfares/settings';
import './tasks/artifact';
import './tasks/circom';
import './tasks/debug';
import './tasks/deploy';
import './tasks/game';
import './tasks/lobby';
import './tasks/subgraph';
import './tasks/upgrades';
import './tasks/utils';
import './tasks/wallet';
import './tasks/whitelist';
import './tasks/batch';
import './tasks/airdrop';
import './tasks/admin';

require('dotenv').config();

const { DEPLOYER_MNEMONIC, ADMIN_PUBLIC_ADDRESS } = process.env;

// Ensure we can lookup the needed workspace packages
const packageDirs = {
  '@dfares/contracts': settings.resolvePackageDir('@dfares/contracts'),
  '@dfares/snarks': settings.resolvePackageDir('@dfares/snarks'),
};

extendEnvironment((env: HardhatRuntimeEnvironment) => {
  env.DEPLOYER_MNEMONIC = DEPLOYER_MNEMONIC;
  // cant easily lookup deployer.address here so well have to be ok with undefined and check it later
  env.ADMIN_PUBLIC_ADDRESS = ADMIN_PUBLIC_ADDRESS;

  env.packageDirs = packageDirs;

  env.contracts = lazyObject(() => {
    const contracts = require('@dfares/contracts');
    return settings.parse(decodeContracts, contracts);
  });

  env.initializers = lazyObject(() => {
    const { initializers = {} } = settings.load(env.network.name);
    return settings.parse(decodeInitializers, initializers);
  });

  env.adminPlanets = lazyObject(() => {
    const { planets = [] } = settings.load(env.network.name);
    return settings.parse(decodeAdminPlanets, planets);
  });
});

// The xdai config, but it isn't added to networks unless we have a DEPLOYER_MNEMONIC
const xdai = {
  url: process.env.XDAI_RPC_URL ?? 'https://rpc-df.xdaichain.com/',
  accounts: {
    mnemonic: DEPLOYER_MNEMONIC,
  },
  chainId: 100,
  gasMultiplier: 5,
};

// The mainnet config, but it isn't added to networks unless we have a DEPLOYER_MNEMONIC
const mainnet = {
  // Brian's Infura endpoint (free tier)
  url: 'https://mainnet.infura.io/v3/5459b6d562eb47f689c809fe0b78408e',
  accounts: {
    mnemonic: DEPLOYER_MNEMONIC,
  },
  chainId: 1,
};

const redstoneTestnet = {
  url: process.env.REDSTONE_TESTNET_RPC_URL,
  accounts: {
    mnemonic: process.env.DEPLOYER_MNEMONIC,
  },
  chainId: Number(process.env.REDSTONE_TESTNET_CHAINID),
};

const redstone = {
  url: process.env.REDSTONE_RPC_URL,
  accounts: {
    mnemonic: process.env.DEPLOYER_MNEMONIC,
  },
  chainId: Number(process.env.REDSTONE_CHAINID),
  gasMultiplier: 5,
  gasPrice: 100,
};

const agld = {
  url: process.env.AGLD_RPC_URL,
  accounts: {
    mnemonic: process.env.DEPLOYER_MNEMONIC,
  },
  chainId: Number(process.env.AGLD_CHAINID),
};

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    // Check for a DEPLOYER_MNEMONIC before we add xdai/mainnet network to the list of networks
    // Ex: If you try to deploy to xdai without DEPLOYER_MNEMONIC, you'll see this error:
    // > Error HH100: Network xdai doesn't exist
    ...(DEPLOYER_MNEMONIC ? { xdai } : undefined),
    ...(DEPLOYER_MNEMONIC ? { mainnet } : undefined),
    ...(DEPLOYER_MNEMONIC ? { redstoneTestnet } : undefined),
    ...(DEPLOYER_MNEMONIC ? { redstone } : undefined),
    ...(DEPLOYER_MNEMONIC ? { agld } : undefined),
    localhost: {
      url: 'http://localhost:8545/',
      accounts: {
        // Same mnemonic used in the .env.example
        mnemonic: 'change typical hire slam amateur loan grid fix drama electric seed label',
      },
      chainId: 31337,
    },
    // Used when you dont specify a network on command line, like in tests
    hardhat: {
      accounts: [
        // from/deployer is default the first address in accounts
        {
          privateKey: '0x044C7963E9A89D4F8B64AB23E02E97B2E00DD57FCB60F316AC69B77135003AEF',
          balance: '100000000000000000000000',
        },
        // user1 in tests
        {
          privateKey: '0x523170AAE57904F24FFE1F61B7E4FF9E9A0CE7557987C2FC034EACB1C267B4AE',
          balance: '100000000000000000000000',
        },
        // user2 in tests
        // admin account
        {
          privateKey: '0x67195c963ff445314e667112ab22f4a7404bad7f9746564eb409b9bb8c6aed32',
          balance: '100000000000000000000000',
        },
      ],
      blockGasLimit: 16777215,
      mining: {
        auto: false,
        interval: 1000,
      },
    },
  },
  solidity: {
    version: '0.8.10',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  circom: {
    inputBasePath: '../circuits/',
    outputBasePath: packageDirs['@dfares/snarks'],
    ptau: 'powersOfTau28_hez_final_15.ptau',
    circuits: [
      {
        name: 'init',
        circuit: 'init/circuit.circom',
        input: 'init/input.json',
        beacon: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'move',
        circuit: 'move/circuit.circom',
        input: 'move/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'biomebase',
        circuit: 'biomebase/circuit.circom',
        input: 'biomebase/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'reveal',
        circuit: 'reveal/circuit.circom',
        input: 'reveal/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
      {
        name: 'whitelist',
        circuit: 'whitelist/circuit.circom',
        input: 'whitelist/input.json',
        beacon: '0000000005060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      },
    ],
  },
  typechain: {
    outDir: path.join(packageDirs['@dfares/contracts'], 'typechain'),
    target: 'ethers-v5',
  },
  diamondAbi: {
    // This plugin will combine all ABIs from any Smart Contract with `Facet` in the name or path and output it as `DarkForest.json`
    name: 'DarkForest',
    include: ['Facet'],
    // We explicitly set `strict` to `true` because we want to validate our facets don't accidentally provide overlapping functions
    strict: true,
    // We use our diamond utils to filter some functions we ignore from the combined ABI
    filter(abiElement: unknown, index: number, abi: unknown[], fullyQualifiedName: string) {
      // Events can be defined in internal libraries or multiple facets and look like duplicates
      if (diamondUtils.isOverlappingEvent(abiElement)) {
        return false;
      }
      // Errors can be defined in internal libraries or multiple facets and look like duplicates
      if (diamondUtils.isOverlappingError(abiElement)) {
        return false;
      }
      const signature = diamondUtils.toSignature(abiElement);
      return diamondUtils.isIncluded(fullyQualifiedName, signature);
    },
  },
  abiExporter: [
    {
      // This plugin will copy the ABI from the DarkForest artifact into our `@dfares/contracts` package as `abis/DarkForest.json`
      path: path.join(packageDirs['@dfares/contracts'], 'abis'),
      runOnCompile: true,
      // We don't want additional directories created, so we just return the contractName
      rename(_sourceName, contractName) {
        return contractName;
      },
      // We **only** want to copy the DarkForest ABI (which is the Diamond ABI we generate) and the initializer ABI to this folder, so we limit the matched files with the `only` option
      only: [':DarkForest$', ':DFInitialize$'],
    },
    {
      path: path.join(packageDirs['@dfares/contracts'], 'abis'),
      runOnCompile: true,
      // This is a "stripped" version for the subgraph, so we append `_stripped`
      rename(_sourceName, contractName) {
        return `${contractName}_stripped`;
      },
      // Subgraph doesn't need the initializer ABI
      only: [':DarkForest$'],
      // We need to remove some ABI functions that subgraph can't handle
      filter(abiElement) {
        return subgraphUtils.abiFilter(abiElement);
      },
    },
  ],
};

export default config;
