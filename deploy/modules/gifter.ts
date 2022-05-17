import { strict as assert } from 'node:assert'
import _ from 'lodash'
import delay from 'delay'
import { Contract } from '@ethersproject/contracts'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress, Context } from '../utils'

interface GifterDeployment {
  proxy: Contract,
  impl: Contract,
  proxyConstructorArgs: any[],
  implConstructorArgs: any[],
}

interface DeployGifterArgs {
  cardMarket: Contract
}

export const deployGifter = async (ctx: Context = {} as Context, { cardMarket }: DeployGifterArgs): Promise<GifterDeployment> => {
  const { log = createLog(), deployedAddressesToSave = {}, expectedDeployedAddresses } = ctx

  return await log.task(`Deploy Gifter`, async parentTask => {
    let impl: Contract = {} as Contract
    const implConstructorArgs: any[] = []

    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'GifterV1', implConstructorArgs)
      await task.log(`Deployed at ${impl.address}`)
    })

    let proxy: Contract = {} as Contract
    const proxyConstructorArgs: any[] = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]

    if (!deployedAddressesToSave.Gifter) {
      await parentTask.task('Deploy proxy contract', async task => {
        proxy = await deployContract(ctx, 'Gifter', proxyConstructorArgs)
        await task.log(`Deployed at ${proxy.address}`)

        if (expectedDeployedAddresses) {
          assertSameAddress(proxy.address, expectedDeployedAddresses.Gifter, 'Gifter')
        }
      })

      deployedAddressesToSave.Gifter = proxy.address

      await delay(5000)

      const gifter = await getContractAt('IGifter', proxy.address)

      await parentTask.task(`Set card market: ${cardMarket.address}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setCardMarket', [cardMarket.address])
      })
    } else {
      await parentTask.task('Upgrade proxy contract', async task => {
        proxy = await getContractAt('Gifter', deployedAddressesToSave.Gifter)

        const instance = await getContractAt('GifterV1', deployedAddressesToSave.Gifter)
        await execMethod({ ctx, task }, instance, 'upgradeTo', [impl.address])
      })
    }

    const gifter = await getContractAt('IGifter', proxy.address)
    
    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})
    const { defaultMetadataCid } = _.get(ctx, 'cids', {})

    if (defaultMetadataCid && baseURI) {
      await parentTask.task(`Set default content hash: ${defaultMetadataCid}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setDefaultContentHash', [defaultMetadataCid])
      })
      
      await parentTask.task('Check default content hash is correct', async () => {
        const h = await gifter.defaultContentHash()
        console.log(`Default content hash: ${h}`)
        assert(h && h === defaultMetadataCid, 'Default content hash incorrect')
      })

      await parentTask.task(`Set default base URI: ${baseURI}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setBaseURI', [baseURI])
      })

      await parentTask.task('Check base URI is correct', async () => {
        const h = await gifter.baseURI()
        console.log(`Base URI: ${h}`)
        assert(h && h === baseURI, 'Base URI incorrect')
      })
    }

    return {
      proxy,
      proxyConstructorArgs,
      impl,
      implConstructorArgs,
    }
  })
}