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
    const implConstructorsArgs = []
    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'GifterV1', implConstructorsArgs)
      await task.log(`Deployed at ${impl.address}`)

      if (isLocalDevnet) {
        assertSameAddress(impl.address, LOCAL_DEVNET_ADDRESSES.gifterImpl, 'gifterImpl')
      }
    })

    let proxy
    let proxyConstructorArgs

    await parentTask.task('Deploy proxy contract', async task => {
      proxyConstructorArgs = [
        impl.address, impl.contract.methods.initialize().encodeABI()
      ]
      proxy = await deployContract(ctx, 'Gifter', proxyConstructorArgs)
      await task.log(`Deployed at ${proxy.address}`)

      if (isLocalDevnet) {
        assertSameAddress(proxy.address, LOCAL_DEVNET_ADDRESSES.gifterProxy, 'gifterProxy')
      }
    })

    await delay(5000)

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

    await parentTask.task(`Set: card market to: ${cardMarketAddress}`, async task => {
      await execMethod({ ctx, task }, gifter, 'setCardMarket', [cardMarketAddress])
    })

    if (deployedAddressesToSave) {
      deployedAddressesToSave.Gifter = proxy.address
    }

    return {
      proxy,
      proxyConstructorArgs,
      impl,
      implConstructorsArgs,
    }
  })
}