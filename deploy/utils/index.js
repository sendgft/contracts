import delay from 'delay'
import _ from 'lodash'
import got from 'got'
import { createLog } from './log'
import { networks } from '../../hardhat.config.js'
import deployedAddresses from '../../deployedAddresses.json'

export { createLog }

const defaultGetTxParams = (txParamsOverride = {}) => Object.assign({
  gasPrice: 1 * 1000000000, // 1 GWEI,
}, txParamsOverride)

let accounts
export const getAccounts = async () => {
  if (!accounts) {
    accounts = (await hre.ethers.getSigners()).map(a => a.address)
  }
  return accounts
}

export const deployContract = async ({ artifacts, getTxParams = defaultGetTxParams }, name, args = [], overrides = {}) => {
  const C = artifacts.require(name)
  const c = await C.new(...args, { ...getTxParams(), ...overrides })
  await delay(5000) // wait for endpoints to catch up
  return c
}

export const getContractAt = async ({ artifacts }, name, addr) => {
  const C = artifacts.require(name)
  return C.at(addr)
}

export const getMatchingNetwork = ({ chainId: id }) => {
  const match = Object.keys(networks).find(k => networks[k].chainId == id)

  if (!match) {
  throw new Error(`Could not find matching network with id ${id}`)
  }

  return Object.assign({
    name: match,
    id,
  }, networks[match], {
    isLocal: (id == 31337)
  })
}

export const getLiveGasPrice = async ({ log }) => {
  let gwei

  await log.task('Fetching live fast gas price', async task => {
    const { body } = await got('https://www.ethgasstationapi.com/api/fast', { rejectUnauthorized: false })
    const fast = parseFloat(body)
    gwei = fast + 1
    task.log(`${gwei} GWEI`)
  })

  return gwei
}


export const buildGetTxParamsHandler = async (network, { log }) => {
  // additional tx params (used to ensure enough gas is supplied alongside the correct nonce)
  let getTxParams

  if (!network.isLocal) {
    /*
    - On mainnet, use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    let gwei
    if ('mainnet' === network.name) {
      gwei = await getLiveGasPrice({ log })
    } else {
      gwei = 3
    }

    const signer = (await hre.ethers.getSigners())[1] 
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


export const execMethod = async ({ ctx, task, contract }, method, ...args) => {
  const { getTxParams = defaultGetTxParams } = ctx

  await task.task(`CALL ${method}() on ${contract.address}`, async () => {
    return await contract[method].apply(contract, args.concat(getTxParams()))
  }, { col: 'yellow' })
}

export const getMethodExecutor = ({ ctx, task, contract }) => (method, ...args) => execMethod({ ctx, task, contract }, method, ...args)


export const getDeployedContractInstance = async ({ lookupType, type, network, log }) => {
  log = createLog(log)

  let inst

  await log.task(`Loading ${lookupType} address from deployed address list for network ${network.id}`, async task => {
    inst = await getContractAt(type, _.get(deployedAddresses, `${lookupType}.${network.id}.address`))
    task.log(`Instance: ${inst.address}`)
  })

  return inst
}

export const verifyOnEtherscan = async ({ task, name, args }) => {
  await task.task(`Verify on Etherscan: ${name}`, async t => {
    await t.log(JSON.stringify(args))
    try {
      await hre.run("verify:verify", args)
    } catch (err) {
      if (!err.toString().includes('Already Verified')) {
        throw err
      } else {
        console.warn('ALREADY VERIFIED!')
      }
    }
  })
}