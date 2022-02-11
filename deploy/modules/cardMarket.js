import _ from 'lodash'
import delay from 'delay'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'
import { ADDRESS_ZERO } from '../../test/utils'

export const deployCardMarket = async (ctx = {}) => {
  const { artifacts, log = createLog(), deployedAddressesToSave, isLocalDevnet } = ctx

  return await log.task(`Deploy Card market`, async parentTask => {
    let impl

    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'CardMarketV1', [])
      await task.log(`Deployed at ${impl.address}`)
    })

    let proxy

    if (!deployedAddressesToSave.CardMarket) {
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

      deployedAddressesToSave.CardMarket = proxy.address        

      await delay(5000)

      const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})

      const cardMarket = await getContractAt({ artifacts }, 'CardMarketV1', proxy.address)

      if (baseURI) {
        await parentTask.task(`Set: default base URI: ${baseURI}`, async task => {
          await execMethod({ ctx, task }, cardMarket, 'setBaseURI', [baseURI])
        })
      }

      await parentTask.task(`Add card1 to card market`, async task => {
        await execMethod({ ctx, task }, cardMarket, 'addCard', [ctx.cids.card1MetadataCid, ADDRESS_ZERO, "0"])
      })

    } else {
      await parentTask.task('Upgrade proxy contract', async task => {
        proxy = await getContractAt({ artifacts }, 'CardMarket', deployedAddressesToSave.CardMarket)
        const instance = await getContractAt({ artifacts }, 'CardMarketV1', deployedAddressesToSave.CardMarket)
        await execMethod({ ctx, task }, instance, 'upgradeTo', [impl.address])
      })
    }

    return {
      proxy,
      impl,
    }
  })
}