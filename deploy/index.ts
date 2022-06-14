import _ from 'lodash'
import { ethers } from 'hardhat'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getSigners, verifyOnEtherscan, fundAddress, getBalance, Context, VerifyAddressParams } from './utils'
import { 
  deployGifter, 
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

  const defaultSigner: SignerWithAddress = signers[0]

  console.log(`Deploying from: ${defaultSigner.address}`)

  await log.task(`Check balance`, async task => {
    const bal = (await getBalance(defaultSigner.address)).toCoinScale()
    await task.log(`Balance ${bal.toString()} ETH/native token`)
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
    verifyOnBlockExplorer: [],
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
    case 'avalanche':
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
    case 'avalanche':
      dex = await deployAvaxDex(ctx)
      break
      default:
      dex = await deployDummyDex(ctx, { tokens })
  }

  // gifter
  const gifter = await deployGifter(ctx, { dex, tokens })

  // save deployed addresses
  if (!deployConfig.isLocalDevnet) {
    await log.task('Update deployedAddresses.json', async () => {
      fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(deployedAddresses, null, 2), 'utf-8')
    })
  }
  
  // let's verify contracts on etherscan
  ctx.verifyOnBlockExplorer = ctx.verifyOnBlockExplorer || []
  if (ctx.verifyOnBlockExplorer.length && deployConfig.verifyOnEtherscan) {
    await log.task('Verify contracts on block explorer', async task => {
      const secondsToWait = 60
      await task.log(`Waiting ${secondsToWait} seconds for block explorer backend to catch up`)
      await delay(secondsToWait * 1000)

      for (let idx in ctx.verifyOnBlockExplorer!) {
        const a = ctx.verifyOnBlockExplorer![idx]
        await task.log(`Verifying ${(Number(idx) + 1)} of ${ctx.verifyOnBlockExplorer!.length}: ${a.name}`)
        await verifyOnEtherscan({
          task,
          name: a.name,
          args: {
            contract: a.name,
            network: network.name,
            address: a.address,
            constructorArguments: a.constructorArgs,
          },
        })
      }
    })
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })