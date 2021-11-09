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

  // // do it
  const c = await deployContract(ctx, 'Gifter')
  console.log(`Deployed at ${c.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })