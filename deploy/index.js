import { _ } from 'lodash'
import path from 'path'
import fs from 'fs'
import delay from 'delay'

import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getAccounts, verifyOnEtherscan } from './utils'
import { deployGifter } from './modules/gifter'


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
  }

  console.log(`Deploying from: ${accounts[0]}`)

  // do it
  const { impl, proxy, proxyConstructorArgs, implConstructorArgs } = await deployGifter(ctx, log)

  if (process.env.PRODUCTION) {
    console.log(`\nProduction release!!\n`)

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

    // write to deployed addresses
    if (network.name === 'avax' || network.name === 'rinkeby') {
      await log.task('Update deployedAddresses.json', async task => {
        const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
        const json = require(deployedAddressesJsonFilePath)
        json.Gifter = _.get(json, 'Gifter', {})
        json.Gifter.chains = _.get(json, 'Gifter.chains', {})
        json.Gifter.chains[network.id] = proxy.address
        fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(json, null, 2), 'utf-8')
      })
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })