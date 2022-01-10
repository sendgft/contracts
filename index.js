let deployedAddresses
try {
  deployedAddresses = require('./deployedAddresses.json')
} catch (_ignore) {}

const contracts = require('./contracts.generated.js')
const { LOCAL_DEVNET_ADDRESSES } = require('./utils/constants.js')

const extractEventsFromAbis = c => c.reduce((output, contract) => {
  contract.abi.filter(({ type }) => type === 'event').forEach(e => {
    if (!output[e.name]) {
      output[e.name] = e
    }
  })
  return output
}, {})

module.exports = {
  LOCAL_DEVNET_ADDRESSES,
  addresses: deployedAddresses,
  contracts,
  events: extractEventsFromAbis(Object.values(contracts)),
}