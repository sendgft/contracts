import { EventFragment } from "@ethersproject/abi"
import { ContractInterface } from "@ethersproject/contracts"

interface ContractDeployedAddresses {
  chains: Record<string, string>
}

type DeployedAddresses = Record<string, ContractDeployedAddresses>

export const addresses: DeployedAddresses

interface ContractJson {
  abi: ContractInterface
}

type ContractJsons = Record<string, ContractJson>

export const contracts: ContractJsons


type EventAbis = Record<string, EventFragment>

export const events: EventAbis