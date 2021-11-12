import { _ } from 'lodash'
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
  const c = await deployContract(ctx, 'Gifter')
  console.log(`Deployed at ${c.address}`)

  // write to deployed addresses
  if (network.name === 'avax' || network.name === 'rinkeby') {
    const deployedAddressesJsonFilePath = path.join(__dirname, '..', 'deployedAddresses.json')
    const json = require(deployedAddressesJsonFilePath)
    json.Gifter = _.get(json, 'Gifter', {})
    json.Gifter.chains = _.get(json, 'Gifter.chains', {})
    json.Gifter.chains[network.id] = _.get(json, `Gifter.chains.${network.id}`, {})
    json.Gifter.chains[network.id].address = c.address
    fs.writeFileSync(deployedAddressesJsonFilePath, JSON.stringify(json, null, 2), 'utf-8')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })