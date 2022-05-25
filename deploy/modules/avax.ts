import { Contract } from '@ethersproject/contracts'

import { createLog, deployContract, assertSameAddress, getContractAt, Context } from '../utils'


export const deployAvaxDex = async (ctx: Context = {} as Context) => {
  const { log = createLog(), expectedDeployedAddresses, deployedAddressesToSave = {} } = ctx

  let dex: Contract = {} as Contract

  if (!deployedAddressesToSave.Dex) {
    await log.task(`Deploy Avalanche DEX`, async parentTask => {
      dex = await deployContract(ctx, 'AvaxDex', [])

      await parentTask.log(`Deployed at ${dex.address}`)

      if (expectedDeployedAddresses) {
        assertSameAddress(dex.address, expectedDeployedAddresses.Dex, 'Dex')
      }

      deployedAddressesToSave.Dex = dex.address
    })
  } else {
    dex = await getContractAt('IDex', deployedAddressesToSave.Dex)
  }

  return dex
}