import _ from 'lodash'
import { ethers } from 'hardhat'
import { BigVal } from 'bigval'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getSigners, verifyOnEtherscan, fundAddress, getBalance, Context } from './utils'
import { 
  deployGifter, 
  deployCardMarket, 
  deployMulticall, 
  deployDummyTokens, 
  deployDummyDex,
  deployIpfsAssets,
  deployAvaxDex,
} from './modules'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { LOCAL_DEVNET_ADDRESSES } from '../src/constants'

const ERC20_ABI = require('../abi/ERC20.json')
const deployConfig = require('../deployConfig.json')

const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
const deployedAddresses = require(deployedAddressesJsonFilePath)


async function main() {
  const log = createLog(console.log.bind(console))

  const network = getMatchingNetwork(await ethers.provider.getNetwork())

  console.log(`Network: ${network.name} (chainId: ${network.id})`)

  if (network.name === 'hardhat') {
    network.name = 'localhost'
  }

  if (network.name !== deployConfig.network) {
    throw new Error(`Network mismatch: ${network.name} !== ${deployConfig.network}`)
  }

  const signers = await getSigners()

  let defaultSigner: SignerWithAddress

  if (deployConfig.isLocalDevnet) {
    defaultSigner = signers[0]
  } else {
    defaultSigner = signers[10]
  }

  console.log(`Deploying from: ${defaultSigner.address}`)

  await log.task(`Deployment process`, async task => {
    const bal = (await getBalance(defaultSigner.address)).toCoinScale()

    await task.log(`Balance ${bal.toString()} ETH`)

    if (bal.lt(1)) {
      await task.log(`Topping up balance from ${signers[0].address} ...`)

      await fundAddress(defaultSigner.address, new BigVal(1, 'coins').sub(bal).toMinScale().toString())

      await task.log(`... topped up!`)
    }
  })

  const getTxParams = await buildGetTxParamsHandler(network, defaultSigner, log)

  deployedAddresses[network.id] = deployedAddresses[network.id] || {}

  const ctx: Context = {
    signers,
    defaultSigner,
    log,
    network,
    getTxParams,
    deployConfig,
    expectedDeployedAddresses: deployConfig.isLocalDevnet ? LOCAL_DEVNET_ADDRESSES : undefined,
    deployedAddressesToSave: deployedAddresses[network.id],
  }

  // ipfs
  await deployIpfsAssets(ctx)

  // do multicall
  if (deployConfig.isLocalDevnet) {
    await deployMulticall(ctx)
  }

  // fee tokens
  let tokens: any[] = []
  if (deployConfig.deployDummyTokens) {
    tokens = await deployDummyTokens(ctx)
  }

  switch (network.name) {
    case 'avax':
      tokens = tokens.concat([
        new ethers.Contract('0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664', ERC20_ABI, defaultSigner) // USDC.e
      ])
      break
    default:
      // do nothing
  }

  // dex 
  let dex
  switch (network.name) {
    case 'avax':
      dex = await deployAvaxDex(ctx)
      break
      default:
      dex = await deployDummyDex(ctx, { tokens })
  }

  // card market
  const cardMarket = await deployCardMarket(ctx, { dex, tokens })

  // gifter
  const gifter = await deployGifter(ctx, { cardMarket: cardMarket.proxy })

  // save deployed addresses
  if (!deployConfig.isLocalDevnet) {
    await log.task('Update deployedAddresses.json', async () => {
      fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(deployedAddresses, null, 2), 'utf-8')
    })
  }
  
  // let's verify contract on etherscan
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