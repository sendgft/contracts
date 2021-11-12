import { _ } from 'lodash'
import path from 'path'
import fs from 'fs'
import delay from 'delay'
import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getAccounts, deployContract } from './utils'

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

  // do it
  let contract
  await log.task('Deploy contract', async task => {
    contract = await deployContract(ctx, 'Gifter')
    await task.log(`Deployed at ${contract.address}`)
  })

  if (process.env.PRODUCTION) {
    console.log(`\nProduction release!!\n`)

    // for rinkeby let's verify contract on etherscan
    if (network.name === 'rinkeby') {
      await log.task('Verify contract on Etherscan', async task => {
        await task.log('Waiting 20 seconds for Etherscan backend to catch up')
        await delay(20000)

        await task.log('Verifying...')
        await hre.run("verify:verify", {
          network: network.name,
          address: contract.address,
          constructorArguments: [],
        });
      })
    }

    // write to deployed addresses
    if (network.name === 'avax' || network.name === 'rinkeby') {
      await log.task('Update deployedAddresses.json', async task => {
        const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
        const json = require(deployedAddressesJsonFilePath)
        json.Gifter = _.get(json, 'Gifter', {})
        json.Gifter.chains = _.get(json, 'Gifter.chains', {})
        json.Gifter.chains[network.id] = _.get(json, `Gifter.chains.${network.id}`, {})
        json.Gifter.chains[network.id].address = contract.address
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