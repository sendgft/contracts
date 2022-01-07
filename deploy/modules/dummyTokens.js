import _ from 'lodash'

import { createLog, deployContract } from '../utils'

const DEFAULT_WALLETS = {
  test: `0x0b5Ce60a5cD884d68dFB124F956667386ee676dd`,
  hua: `0xae48Ec9718e887f52758Cd1DeE1236b98CdfBA93`,
  ram: `0xb1B6e377aA6ec6928A1D499AE58483B2B99658Ec`,
}

export const deployDummyTokens = async ({ artifacts, log, deployedAddressesToSave }) => {
  if (!log) {
    log = createLog()
  }

  const tokens = []
  for (let i = 0; i < 3; i += 1) {
    let token

    const symbol = `GFT_DUMMY_${i + 1}`

    await log.task(`Deploy ERC-20: ${symbol}`, async task => {
      tokens.push(await deployContract({ artifacts }, 'DummyToken', [
        `Gft Dummy Token ${i + 1}`,
        symbol,
        18,
        0,
      ]))

      token = tokens[i]

      await task.log(`Deployed at ${token.address}`)
    })

    await log.task(`Set initial balances`, async task => {
      const wallets = Object.values(DEFAULT_WALLETS)

      for (let i = 0; wallets.length > i; i += 1) {
        await token.mint(wallets[i], 100)
      }

      await task.log(`Balances set.`)
    })

    if (deployedAddressesToSave) {
      deployedAddressesToSave[symbol] = tokens[0].address
    }
  }

  return tokens
}