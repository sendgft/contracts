import { BigVal } from 'bigval'
import { weiStr, EvmSnapshot, expect, extractEventArgs, getBalance, ADDRESS_ZERO } from './utils'
import { deployCardMarket } from '../deploy/modules/cardMarket'
import { getSigners, getContractAt } from '../deploy/utils'
import { events } from '..'
import { deployDummyDex } from '../deploy/modules/dummy'

const DummyToken = artifacts.require("DummyToken")

describe('Dummy DEX', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let dex
  let token1
  let token2

  before(async () => {
    accounts = (await getSigners()).map(a => a.address)
    dex = await deployDummyDex({ artifacts })
    token1 = await DummyToken.new('Wrapped ETH 1', 'WETH1', 18, 0)
    token2 = await DummyToken.new('Wrapped ETH 2', 'WETH2', 18, 0)
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('set price', async () => {
    it ('must correlate', async () => {
      await dex.setPrice(
        token1.address, 
        token2.address, 
        weiStr('2 coins'),
        weiStr('1 coins')
      ).should.be.rejectedWith('must correlate')
    })

    it('set for token <-> token', async () => {
      const p1 = weiStr('2 coins')
      const p2 = weiStr('0.5 coins')

      await dex.setPrice(token1.address, token2.address, p1, p2)

      const pp1 = await dex.prices(token1.address, token2.address)
      expect(new BigVal(pp1).toString()).to.eq(p1)      

      const pp2 = await dex.prices(token2.address, token1.address)
      expect(new BigVal(pp2).toString()).to.eq(p2)
    })

    it('set for native <-> token', async () => {
      const p1 = weiStr('2 coins')
      const p2 = weiStr('0.5 coins')

      await dex.setPrice(ADDRESS_ZERO, token2.address, p1, p2)

      const pp1 = await dex.prices(ADDRESS_ZERO, token2.address)
      expect(new BigVal(pp1).toString()).to.eq(p1)

      const pp2 = await dex.prices(token2.address, ADDRESS_ZERO)
      expect(new BigVal(pp2).toString()).to.eq(p2)
    })
  })

  describe('check amounts', async () => {
    beforeEach(async () => {
      // 1 token1 = 2 token2
      await dex.setPrice(
        token1.address, 
        token2.address, 
        weiStr('2 coins'),
        weiStr('0.5 coins')
      )
    })

    it('token2 -> token1', async () => {
      const amt = await dex.calcInAmount(token1.address, weiStr('6 coins'), token2.address)
      expect(new BigVal(amt).toString()).to.eq(weiStr('12 coins'))
    })

    it('token1 -> token2', async () => {
      const amt = await dex.calcInAmount(token2.address, weiStr('6 coins'), token1.address)
      expect(new BigVal(amt).toString()).to.eq(weiStr('3 coins'))
    })
  })

  describe('trade', async () => {
    beforeEach(async () => {
      // 1 token1 = 2 token2
      await dex.setPrice(
        token1.address,
        token2.address,
        weiStr('2 coins'),
        weiStr('0.5 coins')
      )

      // 1 native token = 0.5 token2
      await dex.setPrice(
        ADDRESS_ZERO,
        token2.address,
        weiStr('0.5 coins'),
        weiStr('2 coins')
      )

      await token1.mint(accounts[0], weiStr('100 coins'))
      await token2.mint(accounts[0], weiStr('100 coins'))
    })

    it('token1 -> token2', async () => {
      await token2.transfer(dex.address, weiStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('10 coins'))
      
      await token1.approve(dex.address, weiStr('2 coins'))
      await dex.trade(token2.address, weiStr('4 coins'), token1.address, weiStr('2 coins'), accounts[0], accounts[1])

      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('6 coins'))
      await token1.balanceOf(accounts[0]).should.eventually.eq(weiStr('98 coins'))
      await token2.balanceOf(accounts[1]).should.eventually.eq(weiStr('4 coins'))
    })

    it('token1 -> token2: excess output captured', async () => {
      await token2.transfer(dex.address, weiStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('10 coins'))

      await token1.approve(dex.address, weiStr('2.5 coins'))
      await dex.trade(token2.address, weiStr('4 coins'), token1.address, weiStr('2.5 coins'), accounts[0], accounts[1])

      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('5 coins'))
      await token1.balanceOf(accounts[0]).should.eventually.eq(weiStr('97.5 coins'))
      await token2.balanceOf(accounts[1]).should.eventually.eq(weiStr('5 coins'))
    })

    it('input token not approved', async () => {
      await token2.transfer(dex.address, weiStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('10 coins'))

      await dex.trade(token2.address, weiStr('4 coins'), token1.address, weiStr('2 coins'), accounts[0], accounts[1])
        .should.be.rejectedWith('exceeds allowance')
    })

    it('input token not enough', async () => {
      await token2.transfer(dex.address, weiStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(weiStr('10 coins'))

      await dex.trade(token2.address, weiStr('4 coins'), token1.address, weiStr('1 coins'), accounts[0], accounts[1])
        .should.be.rejectedWith('not enough input')
    })
  })
})