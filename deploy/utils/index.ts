import { Contract } from '@ethersproject/contracts'
import delay from 'delay'
import { BigVal } from 'bigval'
import { strict as assert } from 'assert'
import got from 'got'
import { ethers, run, artifacts } from 'hardhat'

import { createLog, Logger } from './log'
import cfg from '../../hardhat.config'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export { createLog }

const { networks } = cfg

export interface NetworkInfo {
  name: string,
  id: number,
  isLocal: boolean,
}

export type GetTxParamsHandler = (a: object) => object

export interface VerifyAddressParams {
  name: string,
  address: string,
  constructorArgs: any[],
}

export interface Context {
  signers: SignerWithAddress[],
  defaultSigner: SignerWithAddress,
  log: Logger,
  network: NetworkInfo,
  getTxParams: GetTxParamsHandler,
  deployConfig: any,
  expectedDeployedAddresses?: Record<string, string>,
  deployedAddressesToSave?: any,
  verifyOnBlockExplorer?: VerifyAddressParams[],
  cids?: any,
}

interface ExecContext {
  ctx: Context,
  task: Logger,
}

const defaultGetTxParams = (txParamsOverride: any = {}): object => Object.assign({
  gasPrice: 1 * 1000000000, // 1 GWEI,
}, txParamsOverride)

let signers: SignerWithAddress[]
export const getSigners = async (): Promise<SignerWithAddress[]> => {
  if (!signers) {
    signers = (await ethers.getSigners())
  }
  return signers
}

export const getBalance = async (addr: string): Promise<BigVal> => {
  const val = await ethers.provider.getBalance(addr)
  return new BigVal(val)
}

export const fundAddress = async (addr: string, weiString: string): Promise<void> => {
  await (await signers[0].sendTransaction({
    to: addr,
    value: ethers.BigNumber.from(weiString),
  })).wait()
}

export const getContractAt = async (name: string, addr: string) => {
  const code = await ethers.provider.getCode(addr)
  assert(code !== '0x', `No code found at ${addr}, could not get instance of ${name}`)
  const C = artifacts.require(name)
  return C.at(addr)
}

export const deployContract = async ({ getTxParams = defaultGetTxParams }: Context, name: string, args: any[] = [], txOverrides: any = {}) => {
  const C = artifacts.require(name)
  const c = await C.new(...args, { ...getTxParams(txOverrides) })
  await delay(5000) // wait for endpoints to catch up
  return c
}

export const getMatchingNetwork = ({ chainId: id }: { chainId: number }): NetworkInfo => {
  const match = Object.keys(networks!).find(k => networks![k]!.chainId === id)

  if (!match) {
    throw new Error(`Could not find matching network with id ${id}`)
  }

  return Object.assign({
    name: match,
    id,
  }, networks![match], {
    isLocal: (id === 31337)
  })
}

export const getLiveGasPrice = async (log: Logger): Promise<number> => {
  let gwei: number = 0

  await log.task('Fetching live fast gas price', async task => {
    const { body } = await got('https://www.ethgasstationapi.com/api/fast', { rejectUnauthorized: false })
    const fast = parseFloat(body)
    gwei = fast + 1
    task.log(`${gwei} GWEI`)
  })

  return gwei
}


export const buildGetTxParamsHandler = async (network: any, signer: SignerWithAddress, log: Logger): Promise<GetTxParamsHandler> => {
  // additional tx params (used to ensure enough gas is supplied alongside the correct nonce)
  let getTxParams = defaultGetTxParams

  if (!network.isLocal) {
    /*
    - On mainnet, use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    let gwei: number
    switch (network.name) {
      case 'ethereum':
        gwei = await getLiveGasPrice(log)
        break
      case 'avalanche':
        gwei = 25
        break
      case 'polygon':
        gwei = 50
        break
      default:
        gwei = 3
    }

    const address = await signer.getAddress()

    let nonce = await signer.getTransactionCount()

    getTxParams = (txParamsOverride = {}) => {
      log.log(`Nonce: ${nonce}`)

      nonce += 1

      return defaultGetTxParams(Object.assign({
        gasPrice: gwei * 1000000000,
        nonce: nonce - 1,
        from: address,
      }, txParamsOverride))
    }
  }

  return getTxParams
}


export const execMethod = async ({ ctx, task }: ExecContext, contract: Contract, method: string, args: any[] = [], txOverrides: any = {}) => {
  const { getTxParams = defaultGetTxParams } = ctx
  await task.task(`CALL ${method}() on ${contract.address} [${args.join(', ')}]`, async () => {
    return await contract[method].apply(contract, args.concat(getTxParams(txOverrides)))
  }, { col: 'yellow' })
}

export const getMethodExecutor = ({ ctx, task }: ExecContext, contract: Contract) => (method: string, args: any[] = [], txOverrides: any = {}) => execMethod({ ctx, task }, contract, method, args, txOverrides)


export const verifyOnEtherscan = async ({ task, name, args }: { task: Logger, name: string, args: any }): Promise<void> => {
  await task.task(`Verify on Etherscan: ${name}`, async t => {
    await t.log(JSON.stringify(args))
    try {
      await run("verify:verify", args)
    } catch (err: any) {
      if (!err.toString().includes('Already Verified')) {
        throw err
      } else {
        console.warn('ALREADY VERIFIED!')
      }
    }
  })
}


export const assertSameAddress = (input: string, expected: string, errorLabel: string) => {
  if (input.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Mismatch for ${errorLabel}: ${input} was expected to equal ${expected}`)
  }
}