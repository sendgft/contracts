import { Contract } from '@ethersproject/contracts'

import { createLog, deployContract, assertSameAddress, getContractAt, Context } from '../utils'


export const deployPolygonDex = async (ctx: Context = {} as Context) => {
  const { log = createLog(), expectedDeployedAddresses, deployedAddressesToSave = {} } = ctx

  let dex: Contract = {} as Contract

  if (!deployedAddressesToSave.Dex) {
    await log.task(`Deploy Polygon DEX`, async parentTask => {
      dex = await deployContract(ctx, 'UniswapV2Dex', ['0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'])

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