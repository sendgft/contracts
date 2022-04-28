import { Contract } from '@ethersproject/contracts'
import _ from 'lodash'
import delay from 'delay'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress, Context } from '../utils'
import { toMinStr } from 'bigval'

interface DeployCardMarketArgs {
  dex: Contract,
  tokens: Contract[],
}

export const deployCardMarket = async (ctx: Context = {} as Context, { dex, tokens }: DeployCardMarketArgs) => {
  const { log = createLog(), deployedAddressesToSave = {}, expectedDeployedAddresses } = ctx

  return await log.task(`Deploy Card market`, async parentTask => {
    let impl: Contract = {} as Contract
    const implConstructorArgs: any[] = []

    await parentTask.task('Deploy implementation contract', async task => {
      impl = await deployContract(ctx, 'CardMarketV1', implConstructorArgs)
      await task.log(`Deployed at ${impl.address}`)
    })

    let proxy: Contract = {} as Contract
    const proxyConstructorArgs: any[] = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]

    if (!deployedAddressesToSave.CardMarket) {
      await parentTask.task('Deploy proxy contract', async task => {
        proxy = await deployContract(ctx, 'CardMarket', proxyConstructorArgs)
        await task.log(`Deployed at ${proxy.address}`)

        if (expectedDeployedAddresses) {
          assertSameAddress(proxy.address, expectedDeployedAddresses.cardMarketProxy, 'cardMarketProxy')
        }
      })

      deployedAddressesToSave.CardMarket = proxy.address        

      await delay(5000)
    } else {
      await parentTask.task('Upgrade proxy contract', async task => {
        proxy = await getContractAt('CardMarket', deployedAddressesToSave.CardMarket)
        const instance = await getContractAt('CardMarketV1', deployedAddressesToSave.CardMarket)
        await execMethod({ ctx, task }, instance, 'upgradeTo', [impl.address])
      })
    }

    const cardMarket = await getContractAt('CardMarketV1', proxy.address)

    // set tax
    await parentTask.task(`Set tax: 10%`, async task => {
      await execMethod({ ctx, task }, cardMarket, 'setTax', [1000])
    })

    // set Dex
    await parentTask.task(`Set dex: ${dex.address}`, async task => {
      await execMethod({ ctx, task }, cardMarket, 'setDex', [dex.address])
    })

    // set allowed fee tokens
    const feeTokens = tokens.map(t => t.address)
    await parentTask.task(`Set allowed fee tokens: ${feeTokens.join(', ')}`, async task => {
      await execMethod({ ctx, task }, cardMarket, 'setAllowedFeeTokens', [feeTokens])
    })

    // set baseURI
    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})
    if (baseURI) {
      await parentTask.task(`Set default base URI: ${baseURI}`, async task => {
        await execMethod({ ctx, task }, cardMarket, 'setBaseURI', [baseURI])
      })
    }

    // get latest card id
    const lastId: number = (await cardMarket.lastId()).toNumber()

    // add card if it hasn't already been added
    if (_.get(ctx, 'cids.card1MetadataCid')) {
      const cardId = (await cardMarket.cardByCid(ctx.cids.card1MetadataCid)).toNumber()
      if (0 >= cardId) {
        await parentTask.task(`Add card1 to card market`, async task => {
          await execMethod({ ctx, task }, cardMarket, 'addCard', [
            {
              contentHash: ctx.cids.card1MetadataCid,
              fee: {
                tokenContract: tokens[0].address,
                value: toMinStr('10 coins'),
              }
            }
          ])

          await execMethod({ ctx, task }, cardMarket, 'setCardApproved', [
            (await cardMarket.lastId()).toNumber(),
            true
          ])
        })
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
    }

    return {
      proxy,
      proxyConstructorArgs,
      impl,
      implConstructorArgs,
    }
  })
}