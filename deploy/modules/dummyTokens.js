import _ from 'lodash'
import { BigVal } from 'bigval'

import { createLog, deployContract, assertSameAddress } from '../utils'
import { DEFAULT_WALLETS, LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'


export const deployDummyTokens = async (ctx = {}) => {
  const { artifacts, log = createLog(), isLocalDevnet, deployedAddressesToSave } = ctx

  const tokens = []

  for (let i = 0; i < 3; i += 1) {
    const label = `Token${i + 1}`

    if (!deployedAddressesToSave[label]) {
      let token

      const symbol = `GFT_TOKEN_${i + 1}`

      await log.task(`Deploy ERC-20: ${symbol}`, async task => {
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

        deployedAddressesToSave[label] = token.address
      })

      await log.task(`Set initial balances`, async task => {
        const wallets = Object.values(DEFAULT_WALLETS)

        for (let i = 0; wallets.length > i; i += 1) {
          await token.mint(wallets[i], new BigVal(100, 'coins').toMinScale().toString())
        }

        await task.log(`Balances set.`)
      })
    }
 }

  return tokens
}