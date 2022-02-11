import _ from 'lodash'
import delay from 'delay'
import { strict as assert } from 'assert'
import got from 'got'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'

export const deployGifter = async (ctx = {}, { cardMarketAddress }) => {
  const { artifacts, log = createLog(), deployedAddressesToSave, isLocalDevnet } = ctx

  return await log.task(`Deploy Gifter`, async parentTask => {
    let impl
    const implConstructorArgs = []

    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'GifterV1', implConstructorArgs)
      await task.log(`Deployed at ${impl.address}`)
    })

    let proxy
    const proxyConstructorArgs = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]

    if (!deployedAddressesToSave.Gifter) {
      await parentTask.task('Deploy proxy contract', async task => {
        proxy = await deployContract(ctx, 'Gifter', proxyConstructorArgs)
        await task.log(`Deployed at ${proxy.address}`)

        if (isLocalDevnet) {
          assertSameAddress(proxy.address, LOCAL_DEVNET_ADDRESSES.gifterProxy, 'gifterProxy')
        }
      })

      deployedAddressesToSave.Gifter = proxy.address

      await delay(5000)

      const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)

      await parentTask.task(`Set: card market to: ${cardMarketAddress}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setCardMarket', [cardMarketAddress])
      })
    } else {
      await parentTask.task('Upgrade proxy contract', async task => {
        proxy = await getContractAt({ artifacts }, 'Gifter', deployedAddressesToSave.Gifter)

        const instance = await getContractAt({ artifacts }, 'GifterV1', deployedAddressesToSave.Gifter)
        await execMethod({ ctx, task }, instance, 'upgradeTo', [impl.address])
      })
    }

    const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)
    
    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})
    const { defaultMetadataCid } = _.get(ctx, 'cids', {})

    if (defaultMetadataCid && baseURI) {
      await parentTask.task(`Set: default content hash: ${defaultMetadataCid}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setDefaultContentHash', [defaultMetadataCid])
      })

      await parentTask.task(`Set: default base URI: ${baseURI}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setBaseURI', [baseURI])
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