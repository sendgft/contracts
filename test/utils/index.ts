// @ts-nocheck
import { hexZeroPad } from 'ethers/lib/utils'
import { EthHdWallet } from 'eth-hd-wallet'
import { ethers, network } from 'hardhat'
import _ from 'lodash'
import chai from 'chai'
import { parseLog } from 'ethereum-event-logs'
import chaiAsPromised from 'chai-as-promised'

export { expect } from 'chai'

import { ADDRESS_ZERO, TEST_MNEMONIC } from '../../src/constants'
import { Contract, Signer } from 'ethers'

export { TEST_MNEMONIC, ADDRESS_ZERO }


chai.use((_chai, utils) => {
  const sanitizeResultVal = (result, val) => {
    // if bignumber
    if (_.get(result, 'toNumber')) {
      if (_.get(val, 'toNumber')) {
        result = result.toString(16)
        val = val.toString(16)
      }
      else if (typeof val === 'string') {
        if (val.startsWith('0x')) {
          result = result.toString(16)
        } else {
          result = result.toString(10)
        }
      }
      else if (typeof val === 'number') {
        result = result.toNumber()
      }
    }

    return [result, val]
  }

  utils.addMethod(_chai.Assertion.prototype, 'eq', function (val) {
    let result = utils.flag(this, 'object')

    if (result instanceof Array && val instanceof Array) {
      const newResult = []
      const newVal = []

      for (let i = 0; result.length > i || val.length > i; i += 1) {
        const [r, v] = sanitizeResultVal(result[i], val[i])
        newResult.push(r)
        newVal.push(v)
      }

      const newResultStr = newResult.join(', ')
      const newValStr = newVal.join(', ')

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(newResultStr).to.not.be.equal(newValStr)
        : new _chai.Assertion(newResultStr).to.be.equal(newValStr)

    } else {
      const [r, v] = sanitizeResultVal(result, val)

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(r).to.not.be.equal(v)
        : new _chai.Assertion(r).to.be.equal(v)
    }
  })

  const _matchObj = (src, val) => {
    const result = utils.flag(src, 'object')

    if (result instanceof Object) {
      const newResult = {}
      const newVal = {}

      Object.keys(result).forEach(i => {
        const [r, v] = sanitizeResultVal(result[i], val[i])
        if (typeof r !== 'undefined') {
          newResult[i] = r
        }
        if (typeof v !== 'undefined') {
          newVal[i] = v
        }
      })

      return { newResult, newVal }
    } else {
      throw new Error(`Not an object: ${result}`)
    }
  }

  utils.addMethod(_chai.Assertion.prototype, 'matchObj', function (val) {
    const { newResult, newVal } = _matchObj(this, val) 
    return (utils.flag(this, 'negate'))
      ? new _chai.Assertion(newResult).to.not.contain(newVal)
      : new _chai.Assertion(newResult).to.contain(newVal)
  })
})

chai.use(chaiAsPromised)

chai.should()

export const balanceOf = w => ethers.provider.getBalance(w)

export const hdWallet = (EthHdWallet as any).fromMnemonic(TEST_MNEMONIC)
hdWallet.generateAddresses(10)

export const parseEvents = (result, e) => {
  return parseLog(result.receipt.rawLogs, [e])
}

export const extractEventArgs = (result, eventAbi) => {
  const { args } = parseEvents(result, eventAbi).pop() || {}

  if (!args) {
    return null
  }

  for (let key in args) {
    // convert BNs to their base-10 string representations
    if (args[key].toString && args[key].add) {
      args[key] = args[key].toString(10)
    }
  }

  return args
}

export const signCardApproval = async (cardMarketContract: Contract, signer: Signer, cid: string) => {
  const hash = await cardMarketContract.calculateSignatureHash(cid)
  return await signer.signMessage(ethers.utils.arrayify(hash))
}


const callJsonRpcMethod = async (method, params = []) => network.provider.send(method, params)

export class EvmSnapshot {
  _ids: any[]

  constructor() {
    this._ids = []
  }

  async take() {
    this._ids.push(await callJsonRpcMethod('evm_snapshot'))
  }

  async restore() {
    if (!this._ids.length) {
      throw new Error('No more snapshots to revert to')
    }

    await callJsonRpcMethod('evm_revert', [this._ids.pop()])
  }
}

export const createConfig = designId => hexZeroPad(`0x${Number(designId).toString(16)}`, 32)
