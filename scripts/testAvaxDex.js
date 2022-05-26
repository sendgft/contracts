#!/usr/bin/env node

const ethers = require('ethers')
const { BigVal, toMinStr } = require('bigval')

const ERC20_ABI = require('../abi/ERC20.json')
const { contracts } = require('../')

const mnemonic = process.env.MNEMONIC

// const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
// const ADDRESS_WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
const ADDRESS_USDC = '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664'

const sendTx = async (prov, txPromise) => {
  const { hash } = await txPromise
  const receipt = await prov.waitForTransaction(hash)
  if (receipt.status !== 1) {
    console.error(receipt)
    throw new Error('Transaction failed!')
  }
  return receipt
}

const sleep = sec => new Promise(resolve => setTimeout(resolve, sec * 1000))

const loadToken = async (address, wallet) => {
  const c = new ethers.Contract(address, ERC20_ABI, wallet)
  const d = await Promise.all([c.name(), c.symbol(), c.decimals()])
  return {
    contract: c,
    address,
    name: d[0],
    symbol: d[1],
    decimals: BigVal.from(d[2]).toNumber(),
  }
}

const oldBalances = {}

const logBalance = async (tkn, wallet) => {
  let t, bal

  if (tkn === null) {
    bal = BigVal.from(await wallet.getBalance())
  } else {
    t = await loadToken(tkn, wallet)
    bal = BigVal.from(await t.contract.balanceOf(wallet.address), 'min', { decimals: t.decimals })
  }
  
  const s = (t) ? t.symbol : 'AVAX'

  oldBalances[wallet.address] = oldBalances[wallet.address] || {}
  oldBalances[wallet.address][s] = oldBalances[wallet.address][s] || []
  const history = oldBalances[wallet.address][s]

  let changeStr
  if (history.length) {
    const ob = history[history.length - 1]
    changeStr = ob.gt(bal) ? `-${ob.sub(bal).toCoinScale().toString()}` : `+${bal.sub(ob).toCoinScale().toString()}`
  }

  console.log(`${s} balance: ${bal.toCoinScale().toString()} ${changeStr ? `(${changeStr})` : ''}`)

  history.push(bal)
}

const gas = {
  gasLimit: 200000,
  gasPrice: '30000000000',
}

const run = async () => {
  const provider = ethers.providers.getDefaultProvider('https://api.avax.network/ext/bc/C/rpc')
  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider)

  console.log(`Account: ${wallet.address}`)

  console.log('Deloying dex')
  const dexFactory = new ethers.ContractFactory(contracts.AvaxDex.abi, contracts.AvaxDex.bytecode, wallet)

  const dex = await dexFactory.deploy()
  console.log(`Deloyed to: ${dex.address}`)

  const usdcToken = await loadToken(ADDRESS_USDC, wallet)

  // check AVAX/USDC prices
  const outAmtStrCoins = '0.05'
  const outAmountStr = toMinStr(`${outAmtStrCoins} coins`, { decimals: usdcToken.decimals })
  const price = BigVal.from(await dex.calcInAmount(ADDRESS_USDC, outAmountStr))
  console.log(`${outAmtStrCoins} ${usdcToken.symbol} = ${price.toCoinScale().toString()} AVAX`)

  // check balances
  await logBalance(null, wallet)
  await logBalance(ADDRESS_USDC, wallet)

  console.log(`Swap AVAX -> USDC.e`)

  await (await dex.trade(ADDRESS_USDC, outAmountStr, wallet.address, {
    value: price.mul(1.01).round().toString(),
    ...gas,
  })).wait()

  // check balances
  await logBalance(null, wallet)
  await logBalance(ADDRESS_USDC, wallet)
}

run()
  .then(() => console.log('Done'))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

