#!/usr/bin/env node

const ethers = require('ethers')
const { BigVal, toMinStr } = require('bigval')

const ERC20_ABI = require('../abi/ERC20.json')
const { contracts } = require('../dist')

const { MNEMONIC } = require('dotenv').config().parsed

const ADDRESS_USDC = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
const ADDRESS_WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
const ADDRESS_QUICKSWAP_ROUTER = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'

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
  
  const s = (t) ? t.symbol : 'MATIC'

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
  gasPrice: '50000000000',
}

const run = async () => {
  const provider = ethers.providers.getDefaultProvider('https://polygon-rpc.com/')
  const wallet = ethers.Wallet.fromMnemonic(MNEMONIC).connect(provider)

  console.log(`Account: ${wallet.address}`)

  console.log('Deploying dex')
  const dexFactory = new ethers.ContractFactory(contracts.UniswapV2Dex.abi, contracts.UniswapV2Dex.bytecode, wallet)

  const dex = await dexFactory.deploy(ADDRESS_QUICKSWAP_ROUTER, ADDRESS_WMATIC, { 
    ...gas,
    gasLimit: 3000000, 
  })
  console.log(`Transaction: ${dex.deployTransaction.hash}`)
  await dex.deployTransaction.wait()
  console.log(`Deployed to: ${dex.address}`)

  const usdcToken = await loadToken(ADDRESS_USDC, wallet)

  // check MATIC/USDC prices
  const outAmtStrCoins = '0.05'
  const outAmountStr = toMinStr(`${outAmtStrCoins} coins`, { decimals: usdcToken.decimals })
  const price = BigVal.from(await dex.calcInAmount(ADDRESS_USDC, outAmountStr))
  console.log(`${outAmtStrCoins} ${usdcToken.symbol} = ${price.toCoinScale().toString()} MATIC`)

  // check balances
  await logBalance(null, wallet)
  await logBalance(ADDRESS_USDC, wallet)

  console.log(`Swap MATIC -> USDC`)

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

