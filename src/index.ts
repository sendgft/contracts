import { EventFragment } from "@ethersproject/abi"
import { ContractInterface } from "@ethersproject/contracts"

type ContractDeployedAddresses = Record<string, string>
type ChainDeployedAddresses = Record<string, ContractDeployedAddresses>
interface ContractJson {
  abi: ContractInterface
}
type ContractJsons = Record<string, ContractJson>
type EventAbis = Record<string, EventFragment>

let deployedAddresses: ChainDeployedAddresses = {} as ChainDeployedAddresses
try {
  deployedAddresses = require('../deployedAddresses.json')
} catch (_ignore) {}

export const addresses = deployedAddresses

export const contracts: ContractJsons = require('../contracts.generated.js')

export const { LOCAL_DEVNET_ADDRESSES } = require('./constants')

const extractEventsFromAbis = (c: any[]): EventAbis => c.reduce((output, contract) => {
  contract.abi.filter(({ type }: any) => type === 'event').forEach((e: any) => {
    if (!output[e.name]) {
      output[e.name] = e
    }
  })
  return output
}, {} as EventAbis)

export const events = extractEventsFromAbis(Object.values(contracts))
