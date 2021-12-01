import { _ } from 'lodash'
import { strict as assert } from 'assert'
import path from 'path'
import fs from 'fs'
import delay from 'delay'
import { createLog, getMatchingNetwork, buildGetTxParamsHandler, getAccounts, deployContract, getContractAt } from './utils'

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
  let impl
  await log.task('Deploy implementation contract', async task => {
    impl = await deployContract(ctx, 'GifterImplementationV1')
    await task.log(`Deployed at ${impl.address}`)
  })

  let proxy
  await log.task('Deploy proxy contract', async task => {
    proxy = await deployContract(ctx, 'Gifter', [
      impl.address, impl.contract.methods.initialize().encodeABI() 
    ])
    await task.log(`Deployed at ${proxy.address}`)
  })

  await log.task('Verify proxy <-> logic', async task => {
    const gifter = await getContractAt(ctx, 'IGifter', proxy.address)
    assert.equal(await gifter.getVersion(), '1')
  })

  if (process.env.PRODUCTION) {
    console.log(`\nProduction release!!\n`)

    // for rinkeby let's verify contract on etherscan
    if (network.name === 'rinkeby') {
      await log.task('Verify contracts on Etherscan', async task => {
        await task.log('Waiting 20 seconds for Etherscan backend to catch up')
        await delay(20000)

        await task.log('Verifying...')

        await Promise.all([
          hre.run("verify:verify", {
            network: network.name,
            address: impl.address,
            constructorArguments: [],
          }),
          hre.run("verify:verify", {
            network: network.name,
            address: proxy.address,
            constructorArguments: [],
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
        json.Gifter.chains[network.id] = _.get(json, `Gifter.chains.${network.id}`, {})
        json.Gifter.chains[network.id].address = proxy.address
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