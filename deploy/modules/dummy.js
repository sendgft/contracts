import _ from 'lodash'
import { toMinStr } from 'bigval'

import { createLog, deployContract, assertSameAddress, execMethod, getContractAt } from '../utils'
import { DEFAULT_WALLETS, LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'
import { ADDRESS_ZERO } from '../../test/utils'


export const deployDummyTokens = async (ctx = {}) => {
  const { artifacts, log = createLog(), isLocalDevnet, deployedAddressesToSave = {}} = ctx

  const tokens = []

  for (let i = 0; i < 3; i += 1) {
    const symbol = `GFT_TOKEN_${i + 1}`

    let token

    await log.task(`Setup ERC-20: ${symbol}`, async parentTask => {
      if (!deployedAddressesToSave[symbol]) {

        await parentTask.task(`Deploy token contract`, async task => {
          tokens.push(await deployContract({ artifacts }, 'DummyToken', [
            `GFT Dummy Token ${i + 1}`,
            symbol,
            18,
            0,
          ]))

          token = tokens[tokens.length - 1]

          await task.log(`Deployed at ${token.address}`)

          if (isLocalDevnet) {
            assertSameAddress(token.address, LOCAL_DEVNET_ADDRESSES[symbol], symbol)
          }

          deployedAddressesToSave[symbol] = token.address
        })
      } else {
        token = await getContractAt({ artifacts }, 'DummyToken', deployedAddressesToSave[symbol])
      }

      await parentTask.task(`Mint balances`, async task => {
        const wallets = Object.values(DEFAULT_WALLETS)
        const AMT = toMinStr('100000 coins')

        for (let i = 0; wallets.length > i; i += 1) {
          await execMethod({ ctx, task }, token, 'mint', [wallets[i], AMT])
        }

        await task.log(`Balances set.`)
      })
    })
  }

  return tokens
}

export const deployDummyDex = async (ctx = {}, { tokens = [] } = {}) => {
  const { artifacts, log = createLog(), isLocalDevnet, deployedAddressesToSave = {} } = ctx

  let dex

  await log.task(`Deploy Dummy DEX`, async parentTask => {
    dex = await deployContract({ artifacts }, 'DummyDex', [])

    await parentTask.log(`Deployed at ${dex.address}`)

    if (isLocalDevnet) {
      assertSameAddress(dex.address, LOCAL_DEVNET_ADDRESSES.dex, 'Dex')
    }

    deployedAddressesToSave.dex = dex.address

    for (let token of tokens) {
      const tokenName = await token.symbol()

      await parentTask.task(`Give it balance of 1,000,000,000 ${tokenName} `, async task => {
        await execMethod({ ctx, task }, token, 'mint', [dex.address, toMinStr('1000000000 coins')])
      })

      await parentTask.task(`Set price: Native <-> ${tokenName} = 2000`, async task => {
        await execMethod({ ctx, task }, dex, 'setPrice', [ADDRESS_ZERO, token.address, toMinStr('2000 coins'), toMinStr('0.0005 coins')])
      })
    }
  })

  return dex
}