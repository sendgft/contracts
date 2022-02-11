import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getSigners, verifyOnEtherscan, fundAddress, getBalance } from './utils'
import { deployGifter } from './modules/gifter'
import { deployCardMarket } from './modules/cardMarket'
import { deployMulticall } from './modules/multicall'
import { deployDummyTokens } from './modules/dummyTokens'
import { deployIpfsAssets } from './modules/ipfs'

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

    await log.task(`Deploying from alternative address: ${defaultSigner.address}`, async task => {
      const bal = await getBalance(defaultSigner.address)

      await task.log(`Balance ${bal.toEth().toString()} ETH`)

      if (bal.toEth().lt(1)) {
        await task.log(`Topping up balance ...`)

        await fundAddress(defaultSigner.address, new EthVal(1, 'eth').sub(bal.toEth()).toString())

        await task.log(`... topped up!`)
      }
    })
  } else {
    defaultSigner = signers[0]
  }

  console.log(`Deployer address: ${defaultSigner.address}`)

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

  // card market
  const { proxy: cardMarketProxy } = await deployCardMarket(ctx)

  // gifter
  const { impl, proxy, proxyConstructorArgs, implConstructorArgs } = await deployGifter(ctx, { cardMarketAddress: cardMarketProxy.address })

  // dummy tokens 
  if (deployConfig.deployDummyTokens) {
    await deployDummyTokens(ctx)
  }

  // for rinkeby let's verify contract on etherscan
  if (network.name === 'rinkeby') {
    await log.task('Verify contracts on Etherscan', async task => {
      const secondsToWait = 60
      await task.log(`Waiting ${secondsToWait} seconds for Etherscan backend to catch up`)
      await delay(secondsToWait * 1000)

      await Promise.all([
        verifyOnEtherscan({ 
          task, 
          name: 'proxy', 
          args: {
            network: network.name,
            address: proxy.address,
            constructorArguments: proxyConstructorArgs,
          },
        }),
        verifyOnEtherscan({
          task,
          name: 'implementation',
          args: {
            network: network.name,
            address: impl.address,
            constructorArguments: implConstructorArgs,
          },
        }),
      ])
    })
  }

  // save deployed addresses
  if (!ctx.isLocalDevnet) {
    await log.task('Update deployedAddresses.json', async task => {
      fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(deployedAddresses, null, 2), 'utf-8')
    })
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })