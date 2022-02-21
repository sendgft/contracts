import _ from 'lodash'
import delay from 'delay'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'
import { ADDRESS_ZERO } from '../../test/utils'

export const deployCardMarket = async (ctx = {}) => {
  const { artifacts, log = createLog(), deployedAddressesToSave = {}, isLocalDevnet } = ctx

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

    // get latest card id
    const lastId = (await cardMarket.lastId()).toNumber()

    // add card if it hasn't already been added
    if (_.get(ctx, 'cids.card1MetadataCid')) {
      const cardId = (await cardMarket.cardByCid(ctx.cids.card1MetadataCid)).toNumber()
      if (0 >= cardId) {
        await parentTask.task(`Add card1 to card market`, async task => {
          await execMethod({ ctx, task }, cardMarket, 'addCard', [ctx.cids.card1MetadataCid, ADDRESS_ZERO, "0"])
        })
      }
    }

    // disable old cards
    await parentTask.task(`Disable all old cards owned by admin (check 1 to ${lastId})`, async task => {
      for (let i = 1; i <= lastId; i += 1) {
        const { enabled } = await cardMarket.cards(i)
        if (enabled) {
          await task.task(`Disable card ${i}`, async subTask => {
            await execMethod({ ctx, task: subTask }, cardMarket, 'setCardEnabled', [i, false])
          })
        }
      }
    })

    return {
      proxy,
      proxyConstructorArgs,
      impl,
      implConstructorArgs,
    }
  })
}