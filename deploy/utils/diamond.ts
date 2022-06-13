// Based on https://github.com/mudgen/diamond-1-hardhat/blob/main/scripts/libraries/diamond.js

import { Interface } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2, AddOrReplace: 3 }

// get function selectors from ABI
export const getSelectors = (contract: Contract): string[] => {
  const iface = contract.interface || new Interface(contract.abi)
  const signatures = Object.keys(iface.functions)
  return signatures.reduce((acc: string[], val) => {
    if (val !== 'init(bytes)') {
      acc.push(iface.getSighash(val))
    }
    return acc
  }, [])
}

