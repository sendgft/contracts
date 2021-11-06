let deployedAddresses
try {
  deployedAddresses = require('./deployedAddresses.json')
} catch (_ignore) {}

const releaseConfig = require('./releaseConfig.json')
const contracts = require('./contracts.generated.js')

const extractEventsFromAbis = abis => abis.reduce((output, contract) => {
  contract.abi.filter(({ type }) => type === 'event').forEach(e => {
    if (!output[e.name]) {
      output[e.name] = e
    }
  })
  return output
}, {})

module.exports = {
  addresses: deployedAddresses,
  contracts,
  releaseConfig,
  events: extractEventsFromAbis(Object.values(contracts)),
}