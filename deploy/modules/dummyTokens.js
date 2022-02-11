import _ from 'lodash'
import { BigVal } from 'bigval'

import { createLog, deployContract, assertSameAddress, execMethod, getContractAt } from '../utils'
import { DEFAULT_WALLETS, LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'


export const deployDummyTokens = async (ctx = {}) => {
  const { artifacts, log = createLog(), isLocalDevnet, deployedAddressesToSave } = ctx

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
        const AMT = new BigVal(100, 'coins').toMinScale().toString()

        for (let i = 0; wallets.length > i; i += 1) {
          await execMethod({ ctx, task }, token, 'mint', [wallets[i], AMT])
        }

        await task.log(`Balances set.`)
      })
    })
  }

  return tokens
}