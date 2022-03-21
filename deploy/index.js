import _ from 'lodash'
import { BigVal } from 'bigval'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getSigners, verifyOnEtherscan, fundAddress, getBalance } from './utils'
import { 
  deployGifter, 
  deployCardMarket, 
  deployMulticall, 
  deployDummyTokens, 
  deployDummyDex,
  deployIpfsAssets,
} from './modules'

const deployConfig = require('../deployConfig.json')

const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
const deployedAddresses = require(deployedAddressesJsonFilePath)


async function main() {
  const log = createLog(console.log.bind(console))

  const network = getMatchingNetwork(await hre.ethers.provider.getNetwork())

  console.log(`Network: ${network.name} (chainId: ${network.chainId})`)

  if (network.name === 'hardhat') {
    network.name = 'localhost'
  }

  if (network.name !== deployConfig.network) {
    throw new Error(`Network mismatch: ${network.name} !== ${deployConfig.network}`)
  }

  const signers = await getSigners()

  let defaultSigner

  if (deployConfig.isLocalDevnet) {
    defaultSigner = signers[5]
  } else {
    defaultSigner = signers[7]
  }

  console.log(`Deploying from: ${defaultSigner.address}`)

  await log.task(`Deployment process`, async task => {
    const bal = (await getBalance(defaultSigner.address)).toCoinScale()

    await task.log(`Balance ${bal.toString()} ETH`)

    if (bal.lt(1)) {
      await task.log(`Topping up balance ...`)

      await fundAddress(defaultSigner.address, new BigVal(1, 'coins').sub(bal).toMinScale().toString())

      await task.log(`... topped up!`)
    }
  })

  const getTxParams = await buildGetTxParamsHandler(network, defaultSigner, { log })

  deployedAddresses[network.id] = deployedAddresses[network.id] || {}

  const ctx = {
    artifacts,
    signers,
    defaultSigner,
    log,
    network,
    getTxParams,
    deployConfig,
    isLocalDevnet: !!deployConfig.isLocalDevnet,
    deployedAddressesToSave: deployedAddresses[network.id],
  }

  // ipfs
  await deployIpfsAssets(ctx)

  // do multicall
  if (ctx.isLocalDevnet) {
    await deployMulticall(ctx)
  }

  // fee tokens
  let tokens = []
  if (deployConfig.deployDummyContracts) {
    tokens = await deployDummyTokens(ctx)
  }

  // dex 
  const dex = await deployDummyDex(ctx, { tokens })

  // card market
  const cardMarket = await deployCardMarket(ctx, { dex, tokens })

  // gifter
  const gifter = await deployGifter(ctx, { cardMarket: cardMarket.proxy })

  // save deployed addresses
  if (!ctx.isLocalDevnet) {
    await log.task('Update deployedAddresses.json', async () => {
      fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(deployedAddresses, null, 2), 'utf-8')
    })
  }
  
  // for rinkeby let's verify contract on etherscan
  if (network.name === 'rinkeby') {
    await log.task('Verify contracts on Etherscan', async task => {
      const secondsToWait = 60
      await task.log(`Waiting ${secondsToWait} seconds for Etherscan backend to catch up`)
      await delay(secondsToWait * 1000)

      await Promise.all([
        {
          contract: 'contracts/CardMarket.sol:CardMarket',
          address: cardMarket.proxy.address,
          constructorArgs: cardMarket.proxyConstructorArgs,
        },
        {
          contract: 'contracts/CardMarketV1.sol:CardMarketV1',
          address: cardMarket.impl.address,
          constructorArgs: cardMarket.implConstructorArgs,
        },
        {
          contract: 'contracts/Gifter.sol:Gifter',
          address: gifter.proxy.address,
          constructorArgs: gifter.proxyConstructorArgs,
        },
        {
          contract: 'contracts/GifterV1.sol:GifterV1',
          address: gifter.impl.address,
          constructorArgs: gifter.implConstructorArgs,
        },
      ].map(a => (
        verifyOnEtherscan({
          task,
          name: a.contract,
          args: {
            contract: a.contract,
            network: network.name,
            address: a.address,
            constructorArguments: a.constructorArgs,
          },
        })
      )))
    })
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })