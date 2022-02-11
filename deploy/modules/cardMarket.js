import _ from 'lodash'
import delay from 'delay'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'
import { ADDRESS_ZERO } from '../../test/utils'

export const deployCardMarket = async (ctx = {}) => {
  const { artifacts, log = createLog(), deployedAddressesToSave, isLocalDevnet } = ctx

  return await log.task(`Deploy Card market`, async parentTask => {
    let impl
    const implConstructorArgs = []

    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'CardMarketV1', implConstructorArgs)
      await task.log(`Deployed at ${impl.address}`)
    })

    let proxy
    const proxyConstructorArgs = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]

    if (!deployedAddressesToSave.CardMarket) {
      await parentTask.task('Deploy proxy contract', async task => {
        proxy = await deployContract(ctx, 'CardMarket', proxyConstructorArgs)
        await task.log(`Deployed at ${proxy.address}`)

        if (isLocalDevnet) {
          assertSameAddress(proxy.address, LOCAL_DEVNET_ADDRESSES.cardMarketProxy, 'cardMarketProxy')
        }
      })

      deployedAddressesToSave.CardMarket = proxy.address        

      await delay(5000)
    } else {
      await parentTask.task('Upgrade proxy contract', async task => {
        proxy = await getContractAt({ artifacts }, 'CardMarket', deployedAddressesToSave.CardMarket)
        const instance = await getContractAt({ artifacts }, 'CardMarketV1', deployedAddressesToSave.CardMarket)
        await execMethod({ ctx, task }, instance, 'upgradeTo', [impl.address])
      })
    }

    const cardMarket = await getContractAt({ artifacts }, 'CardMarketV1', proxy.address)

    // set baseURI
    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})
    if (baseURI) {
      await parentTask.task(`Set: default base URI: ${baseURI}`, async task => {
        await execMethod({ ctx, task }, cardMarket, 'setBaseURI', [baseURI])
      })
    }

    // add card if it hasn't already been added
    const cardId = (await cardMarket.cardByCid(ctx.cids.card1MetadataCid)).toNumber()
    if (0 >= cardId) {
      await parentTask.task(`Add card1 to card market`, async task => {
        await execMethod({ ctx, task }, cardMarket, 'addCard', [ctx.cids.card1MetadataCid, ADDRESS_ZERO, "0"])
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