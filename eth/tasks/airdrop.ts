import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('getPlayers', 'get all Players').setAction(getPlayers);

async function getPlayers(args: {}, hre: HardhatRuntimeEnvironment) {
  await hre.run('utils:assertChainId');
  const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);
  //   const radius = await contract.worldRadius();
  //   console.log(radius.toString());

  //   return;

  const N = await contract.getNPlayers();
  console.log('Players Number: ', N.toString());

  const players = await contract.bulkGetPlayers(0, N);
  console.log(players.length);
  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    console.log(player.score.toString());
    // console.log(i, player[1], player[5].toString());

    const balance = await hre.ethers.provider.getBalance(player[1]);
    console.log(player[1], hre.ethers.utils.formatEther(balance), '$RES');
  }

  // const airdropFilePath = './local/account';
  // const accountFileContents = fs.readFileSync(airdropFilePath).toString();
  // const accounts = accountFileContents.split('\n').filter((k) => k.length > 0);
  // console.log(accounts);

  // const accountSet = new Set();
  // for (let i = 0; i < accounts.length; i++) {
  //   const account = accounts[i];
  //   accountSet.add(account);
  // }

  return;
}

// task('batch:account', 'show account(s) in the given file path')
//   .addPositionalParam(
//     'filePath',
//     'the path to the file containing accounts to show',
//     undefined,
//     types.string
//   )
//   .setAction(showAccount);

// async function showAccount(args: { filePath: string }, hre: HardhatRuntimeEnvironment) {
//   await hre.run('utils:assertChainId');
//   const accountFileContents = fs.readFileSync(args.filePath).toString();
//   const accounts = accountFileContents.split('\n').filter((k) => k.length > 0);
//   console.log(accounts);
//   return;
// }

// task('batch:whitelist', 'whitelist account(s) in the given file path')
//   .addPositionalParam(
//     'filePath',
//     'the path to the file containing accounts to whitelist',
//     undefined,
//     types.string
//   )
//   .setAction(batchWhitelist);

// async function batchWhitelist(args: { filePath: string }, hre: HardhatRuntimeEnvironment) {
//   await hre.run('utils:assertChainId');
//   const accountFileContents = fs.readFileSync(args.filePath).toString();
//   const accounts = accountFileContents.split('\n').filter((k) => k.length > 0);
//   //   console.log(accounts);

//   console.log('account number: ' + accounts.length);

//   const contract = await hre.ethers.getContractAt('DarkForest', hre.contracts.CONTRACT_ADDRESS);
//   let cnt = 0;

//   for (const address of accounts) {
//     cnt++;

//     console.log('account id: ', cnt);

//     const isAddress = hre.ethers.utils.isAddress(address);
//     if (!isAddress) {
//       // throw new Error(`Address ${address} is NOT a valid address.`);

//       console.log(`Address ${address} is NOT a valid address.`);
//     }
//     const isWhitelisted = await contract.isWhitelisted(address);
//     if (isWhitelisted) {
//       // throw new Error(`Address ${address} is already whitelisted.`);
//       console.log(`Address ${address} is already whitelisted.`);
//     }

//     try {
//       const whitelistTx = await contract.addToWhitelist(address);
//       await whitelistTx.wait();
//     } catch (e) {
//       console.log('something bad happen');
//     }

//     // const balance = await hre.ethers.provider.getBalance(address);
//     // console.log('whitelist balance:', hre.ethers.utils.formatEther(balance));
//     console.log(`[${new Date()}] Registered player ${address}.`);
//   }
// }

// task('batch:send', 'send token to account(s) in the given file path')
//   .addPositionalParam(
//     'filePath',
//     'the path to the file containing accounts to whitelist',
//     undefined,
//     types.string
//   )
//   .addPositionalParam('value', 'drip value (in ether or xDAI)', undefined, types.float)

//   .setAction(batchSend);

// async function batchSend(
//   args: { filePath: string; value: number },
//   hre: HardhatRuntimeEnvironment
// ) {
//   const beginTime = Date.now();

//   await hre.run('utils:assertChainId');
//   const accountFileContents = fs.readFileSync(args.filePath).toString();
//   const accounts = accountFileContents.split('\n').filter((k) => k.length > 0);

//   console.log('account number: ' + accounts.length);

//   const [admin] = await hre.ethers.getSigners();
//   const beginBalance = await hre.ethers.provider.getBalance(admin.address);

//   console.log('admin:', admin.address);
//   console.log('balance:', hre.ethers.utils.formatEther(beginBalance));

//   for (const address of accounts) {
//     const isAddress = hre.ethers.utils.isAddress(address);
//     if (!isAddress) {
//       throw new Error(`Address ${address} is NOT a valid address.`);
//     }
//     console.log('address:', address);
//     const tx = await admin.sendTransaction({
//       to: address,
//       value: hre.ethers.utils.parseEther(args.value.toString()), // Sends exactly 1.0 ether
//     });

//     await tx.wait();

//     const balance = await hre.ethers.provider.getBalance(admin.address);
//     console.log('admin balance:', hre.ethers.utils.formatEther(balance));
//     const balance2 = await hre.ethers.provider.getBalance(address);
//     console.log('receive account balance: ', hre.ethers.utils.formatEther(balance2));
//     console.log('-------------------------------------------------');
//   }

//   const endTime = Date.now();
//   const deltaTime = Math.ceil((endTime - beginTime) / 1000);
//   console.log('Delta Time: ' + deltaTime + ' s');
// }
