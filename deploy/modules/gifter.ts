import { strict as assert } from 'node:assert'
import _ from 'lodash'
import delay from 'delay'
import { Contract } from '@ethersproject/contracts'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress, Context } from '../utils'
import { FacetCutAction, getSelectors } from '../utils/diamond'
import { ADDRESS_ZERO  } from '../../src/constants'
import { toMinStr } from 'bigval'
import { ethers } from 'hardhat'

interface DeployerGifterArgs {
  dex: Contract,
  tokens: Contract[],
}

interface GifterDeployment {
  diamond: Contract,
  diamondConstructorArgs: any[],
  facets: Record<string, Contract>,
}

const CARD_PRICE_STR = '5 coins'

export const deployGifter = async (ctx: Context = {} as Context, { dex, tokens }: DeployerGifterArgs): Promise<GifterDeployment> => {
  const { log = createLog(), defaultSigner, deployedAddressesToSave = {}, expectedDeployedAddresses } = ctx

  return await log.task(`Deploy Gifter`, async parentTask => {
    let diamond: Contract = {} as Contract
    let diamondConstructorArgs: any[] = []

    if (!deployedAddressesToSave.Gifter) {
      let diamondCutFacet: Contract = {} as Contract

      await parentTask.task('Deploy DiamondCut facet', async task => {
        diamondCutFacet = await deployContract(ctx, 'DiamondCutFacet', [])
        await task.log(`Deployed at ${diamondCutFacet.address}`)
      })

      await parentTask.task('Deploy Diamond contract', async task => {
        diamondConstructorArgs = [defaultSigner.address, diamondCutFacet.address]
        diamond = await deployContract(ctx, 'Gifter', diamondConstructorArgs)
        await task.log(`Deployed at ${diamond.address}`)

        if (expectedDeployedAddresses) {
          assertSameAddress(diamond.address, expectedDeployedAddresses.Gifter, 'Gifter')
        }
      })

      deployedAddressesToSave.Gifter = diamond.address
    }

    let facets: Record<string, Contract> = {}

    await parentTask.task('Deploy facets', async task => {
      for (let fn of [
        'OwnershipFacet', 'ERC1155Facet', 'TokenQueryFacet', 'CardMarketFacet', 'GifterFacet'
      ]) {
        facets[fn] = await deployContract(ctx, fn, [])
      }

      await task.log(`Deployed at ${Object.values(facets).map(f => f.address).join(', ')}`)
    })

    await parentTask.task('Upgrade diamond with facets', async task => {
      const facetCuts = Object.values(facets).map(f => ({
        facetAddress: f.address,
        action: FacetCutAction.AddOrReplace,
        functionSelectors: getSelectors(f)
      }))

      const cutter = await getContractAt('IDiamondCut', diamond.address)

      await execMethod({ ctx, task }, cutter, 'diamondCut', [ facetCuts, ADDRESS_ZERO, [] ])
    })

    await delay(5000)

    const gifter = await getContractAt('IGifter', diamond.address)
    
    const { gateway: baseURI } = _.get(ctx, 'deployConfig.ipfs', {})
    const { defaultMetadataCid } = _.get(ctx, 'cids', {})

    if (defaultMetadataCid && baseURI) {
      await parentTask.task(`Set default gift content hash: ${defaultMetadataCid}`, async task => {
        await execMethod({ ctx, task }, gifter, 'setDefaultGiftContentHash', [defaultMetadataCid])
      })
      
      await parentTask.task('Check default gift content hash is correct', async () => {
        const h = await gifter.defaultGiftContentHash()
        console.log(`Default gift content hash: ${h}`)
        assert(h && h === defaultMetadataCid, 'Default gift content hash incorrect')
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

    const cardMarket = await getContractAt('ICardMarket', diamond.address)

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

    const decimals = await tokens[0].decimals()

    // add card if it hasn't already been added
    if (_.get(ctx, 'cids.card1MetadataCid')) {
      const cardId = await cardMarket.cardIdByCid(ctx.cids.card1MetadataCid)
      if (0 >= cardId.toNumber(0)) {
        await parentTask.task(`Add card1 to card market`, async task => {
          const sig = await task.task('Get admin approval signature', async t => {
            const hash = await cardMarket.calculateSignatureHash(ctx.cids.card1MetadataCid)
            await t.log(`Hash to sign: ${hash}`)
            const sig = await defaultSigner.signMessage(ethers.utils.arrayify(hash))
            await t.log(`Signature: ${sig}`)
            return sig
          })

          await execMethod({ ctx, task }, cardMarket, 'addCard', [
            {
              contentHash: ctx.cids.card1MetadataCid,
              fee: {
                tokenContract: tokens[0].address,
                value: toMinStr(CARD_PRICE_STR, { decimals }),
              }
            },
            defaultSigner.address,
            sig
          ])
        })

        
        // disable old cards
        // const tokenQuery = await getContractAt('ITokenQuery', diamond.address)
        // const numCards = (await tokenQuery.totalTokensByType(TokenType.CARD)).toNumber()
        // await parentTask.task(`Disable all old cards owned by admin (total cards: ${numCards})`, async task => {
        //   for (let i = 1; i < numCards; i += 1) {
        //     const cardId = await tokenQuery.tokenByType(TokenType.CARD, i)
        //     const { enabled, params } = await cardMarket.card(cardId)
        //     if (enabled && params.owner === defaultSigner.address) {
        //       await task.task(`Disable card at index: ${i} => ${cardId.toString()}`, async subTask => {
        //         await execMethod({ ctx, task: subTask }, cardMarket, 'setCardEnabled', [cardId, false])
        //       })
        //     }
        //   }
        // })
      } else {
        await parentTask.task(`Ensure card ${cardId.toString()} is enabled and the price is set`, async t => {
          await execMethod({ ctx, task: t }, cardMarket, 'setCardEnabled', [cardId, true])
          await execMethod({ ctx, task: t }, cardMarket, 'setCardFee', [
            cardId,
            {
              tokenContract: tokens[0].address,
              value: toMinStr(CARD_PRICE_STR, { decimals }),
            }
          ])
        })
      }
    }

    return {
      diamond, 
      diamondConstructorArgs,
      facets, 
    }
  })
}