import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getAccounts, verifyOnEtherscan } from './utils'
import { deployGifter } from './modules/gifter'
import { deployMulticall } from './modules/multicall'
import { deployDummyTokens } from './modules/dummyTokens'

const deployConfig = require('../deployConfig.json')


async function main() {
  const log = createLog(console.log.bind(console))

  const network = getMatchingNetwork(await hre.ethers.provider.getNetwork())

  const accounts = await getAccounts()

  const getTxParams = await buildGetTxParamsHandler(network, { log })

  const ctx = {
    artifacts,
    accounts,
    log,
    network,
    getTxParams,
    deployConfig,
    deployedAddressesToSave: deployConfig.saveDeployedAddresses ? {} : null,
  }

  console.log(`Deploying from: ${accounts[0]}`)

  ctx.isLocalNetwork = ['hardhat', 'localhost'].includes(network.name)

  // do multicall
  if (ctx.isLocalNetwork) {
    await deployMulticall(ctx)
  }

  // proxy
  const { impl, proxy, proxyConstructorArgs, implConstructorArgs } = await deployGifter(ctx)

  // dummy tokens 
  if (_.get(deployConfig, 'deployDummyTokens')) {
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
  if (ctx.deployedAddressesToSave) {
    await log.task('Update deployedAddresses.json', async task => {
      const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
      const json = require(deployedAddressesJsonFilePath)
      Object.keys(ctx.deployedAddressesToSave).forEach(k => {
        json[k] = _.get(json, k, {})
        json[k].chains = _.get(json, `${k}.chains`, {})
        json[k].chains[network.id] = ctx.deployedAddressesToSave[k]
      })
      fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(json, null, 2), 'utf-8')
    })
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })