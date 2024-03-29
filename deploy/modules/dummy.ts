import { Contract } from '@ethersproject/contracts'
import { toMinStr } from 'bigval'

import { createLog, deployContract, assertSameAddress, execMethod, getContractAt, Context } from '../utils'
import { ADDRESS_ZERO, DEFAULT_WALLETS } from '../../src/constants'


export const deployDummyTokens = async (ctx: Context = {} as Context) => {
  const { log = createLog(), expectedDeployedAddresses, deployedAddressesToSave = {}, verifyOnBlockExplorer = []} = ctx

  const tokens: Contract[] = []

  for (let i = 0; i < 3; i += 1) {
    const symbol = `GFT_TOKEN_${i + 1}`

    let token: Contract = {} as Contract

    await log.task(`Setup ERC-20: ${symbol}`, async parentTask => {
      const constructorArgs: any[] = [
        `GFT Dummy Token ${i + 1}`,
        symbol,
        18,
        0,
      ]

      if (!deployedAddressesToSave[symbol]) {
        await parentTask.task(`Deploy token contract`, async task => {
          token = await deployContract(ctx, 'DummyToken', constructorArgs)

          await task.log(`Deployed at ${token.address}`)

          if (expectedDeployedAddresses) {
            assertSameAddress(token.address, expectedDeployedAddresses[symbol], symbol)
          }

          deployedAddressesToSave[symbol] = token.address
        })
      } else {
        token = await getContractAt('DummyToken', deployedAddressesToSave[symbol])
      }

      verifyOnBlockExplorer.push({
        name: 'contracts/DummyToken.sol:DummyToken',
        address: token.address,
        constructorArgs,
      })

      await parentTask.task(`Mint balances`, async task => {
        const wallets = Object.values(DEFAULT_WALLETS)
        const AMT = toMinStr('100000 coins')

        for (let i = 0; wallets.length > i; i += 1) {
          await execMethod({ ctx, task }, token, 'mint', [wallets[i], AMT])
        }

        await task.log(`Balances set.`)
      })

      tokens.push(token)
    })
  }

  return tokens
}

interface DeployDummyDexParams {
  tokens: any[]
}

export const deployDummyDex = async (ctx: Context = {} as Context, params?: DeployDummyDexParams) => {
  const { log = createLog(), expectedDeployedAddresses, deployedAddressesToSave = {}, verifyOnBlockExplorer = [] } = ctx

  const { tokens = [] } = params || {}

  let dex: Contract = {} as Contract

  await log.task(`Deploy Dummy DEX`, async parentTask => {
    if (!deployedAddressesToSave.Dex) {
      dex = await deployContract(ctx, 'DummyDex', [])
      await parentTask.log(`Deployed at ${dex.address}`)

      if (expectedDeployedAddresses) {
        assertSameAddress(dex.address, expectedDeployedAddresses.Dex, 'Dex')
      }

      deployedAddressesToSave.Dex = dex.address
    } else {
      dex = await getContractAt('DummyDex', deployedAddressesToSave.Dex)
    }

    verifyOnBlockExplorer.push({
      name: 'contracts/DummyDex.sol:DummyDex',
      address: dex.address,
      constructorArgs: [],
    })

    for (let token of tokens) {
      const tokenName = await token.symbol()

      await parentTask.task(`Give it balance of 1,000,000,000 ${tokenName} `, async task => {
        await execMethod({ ctx, task }, token, 'mint', [dex.address, toMinStr('1000000000 coins')])
      })

      await parentTask.task(`Set price: Native <-> ${tokenName} = 2000`, async task => {
        await execMethod({ ctx, task }, dex, 'setPrice', [token.address, toMinStr('2000 coins')])
      })
    }
  })

  return dex
}
