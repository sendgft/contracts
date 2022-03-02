import { toMinStr } from 'bigval'
import { EthHdWallet } from 'eth-hd-wallet'
import _ from 'lodash'
import chai from 'chai'
import { parseLog } from 'ethereum-event-logs'
import chaiAsPromised from 'chai-as-promised'

import { TEST_MNEMONIC } from '../../utils/constants'

export { expect } from 'chai'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export const weiStr = toMinStr

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

  utils.addMethod(_chai.Assertion.prototype, 'matchObj', function (val) {
    let result = utils.flag(this, 'object')

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

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(newResult).to.not.contain(newVal)
        : new _chai.Assertion(newResult).to.contain(newVal)

    } else {
      throw new Error('Not an object', result)
    }
  })
})

chai.use(chaiAsPromised)

chai.should()

export const balanceOf = w => hre.ethers.provider.getBalance(w)

export const hdWallet = EthHdWallet.fromMnemonic(TEST_MNEMONIC)
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


const callJsonRpcMethod = async (method, params = []) => hre.network.provider.send(method, params)

export class EvmSnapshot {
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
