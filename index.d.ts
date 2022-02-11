import { EventFragment } from "@ethersproject/abi"
import { ContractInterface } from "@ethersproject/contracts"

type ContractDeployedAddresses = Record<string, string>

type ChainDeployedAddresses = Record<string, ContractDeployedAddresses>

export const addresses: ChainDeployedAddresses

interface ContractJson {
  abi: ContractInterface
}

type ContractJsons = Record<string, ContractJson>

export const contracts: ContractJsons


type EventAbis = Record<string, EventFragment>

export const events: EventAbis

type LocalDevnetAddresses = Record<string, string>

export const LOCAL_DEVNET_ADDRESSES: LocalDevnetAddresses