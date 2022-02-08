import _ from 'lodash'
import delay from 'delay'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'
import { ADDRESS_ZERO } from '../../test/utils'

export const deployCardMarket = async (ctx = {}) => {
  const { artifacts, log = createLog(), deployedAddressesToSave, isLocalDevnet } = ctx

  return await log.task(`Deploy Card market`, async parentTask => {
    let impl
    const implConstructorsArgs = []
    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'CardMarketV1', implConstructorsArgs)
      await task.log(`Deployed at ${impl.address}`)

      if (isLocalDevnet) {
        assertSameAddress(impl.address, LOCAL_DEVNET_ADDRESSES.cardMarketImpl, 'cardMarketImpl')
      }
    })

    let proxy
    let proxyConstructorArgs

    await parentTask.task('Deploy proxy contract', async task => {
      proxyConstructorArgs = [
        impl.address, impl.contract.methods.initialize().encodeABI()
      ]
      proxy = await deployContract(ctx, 'CardMarket', proxyConstructorArgs)
      await task.log(`Deployed at ${proxy.address}`)

      if (isLocalDevnet) {
        assertSameAddress(proxy.address, LOCAL_DEVNET_ADDRESSES.cardMarketProxy, 'cardMarketProxy')
      }
    })

    await delay(5000)

    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})

    const cardMarket = await getContractAt({ artifacts }, 'ICardMarket', proxy.address)

    if (baseURI) {
      await parentTask.task(`Set: default base URI: ${baseURI}`, async task => {
        await execMethod({ ctx, task }, cardMarket, 'setBaseURI', [baseURI])
      })
    }

    await parentTask.task(`Add card1 to card market`, async task => {
      await execMethod({ ctx, task }, cardMarket, 'addCard', [ctx.cids.card1MetadataCid, ADDRESS_ZERO, "0"])
    })

    if (deployedAddressesToSave) {
      deployedAddressesToSave.CardMarket = proxy.address
    }

    return {
      proxy,
      proxyConstructorArgs,
      impl,
      implConstructorsArgs,
    }
  })
}