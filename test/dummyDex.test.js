import { toMinStr, BigVal } from 'bigval'
import { EvmSnapshot, expect, extractEventArgs, balanceOf, ADDRESS_ZERO } from './utils'
import { getSigners, getContractAt } from '../deploy/utils'
import { deployDummyDex } from '../deploy/modules'

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
        toMinStr('2 coins'),
        toMinStr('1 coins')
      ).should.be.rejectedWith('must correlate')
    })

    it('set for token <-> token', async () => {
      const p1 = toMinStr('2 coins')
      const p2 = toMinStr('0.5 coins')

      await dex.setPrice(token1.address, token2.address, p1, p2)

      const pp1 = await dex.prices(token1.address, token2.address)
      expect(new BigVal(pp1).toString()).to.eq(p1)      

      const pp2 = await dex.prices(token2.address, token1.address)
      expect(new BigVal(pp2).toString()).to.eq(p2)
    })

    it('set for native <-> token', async () => {
      const p1 = toMinStr('2 coins')
      const p2 = toMinStr('0.5 coins')

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
        toMinStr('2 coins'),
        toMinStr('0.5 coins')
      )
    })

    it('token2 -> token1', async () => {
      const amt = await dex.calcInAmount(token1.address, toMinStr('6 coins'), token2.address)
      expect(new BigVal(amt).toString()).to.eq(toMinStr('12 coins'))
    })

    it('token1 -> token2', async () => {
      const amt = await dex.calcInAmount(token2.address, toMinStr('6 coins'), token1.address)
      expect(new BigVal(amt).toString()).to.eq(toMinStr('3 coins'))
    })
  })

  describe('trade', async () => {
    beforeEach(async () => {
      // 1 token1 = 2 token2
      await dex.setPrice(
        token1.address,
        token2.address,
        toMinStr('2 coins'),
        toMinStr('0.5 coins')
      )

      // 1 native token = 0.5 token2
      await dex.setPrice(
        ADDRESS_ZERO,
        token2.address,
        toMinStr('0.5 coins'),
        toMinStr('2 coins')
      )

      await token1.mint(accounts[0], toMinStr('100 coins'))
      await token2.mint(accounts[0], toMinStr('100 coins'))

      await token2.transfer(dex.address, toMinStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('10 coins'))
    })

    describe('token <-> token', () => {
      it('token1 -> token2', async () => {
        await token1.approve(dex.address, toMinStr('2 coins'))
        await dex.trade(token2.address, toMinStr('4 coins'), token1.address, accounts[0], accounts[1])

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await token1.balanceOf(accounts[0]).should.eventually.eq(toMinStr('98 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('token1 -> token2: excess input ignored', async () => {
        await token1.approve(dex.address, toMinStr('2.5 coins'))
        await dex.trade(token2.address, toMinStr('4 coins'), token1.address, accounts[0], accounts[1])

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await token1.balanceOf(accounts[0]).should.eventually.eq(toMinStr('98 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('input token not enough', async () => {
        await token1.approve(dex.address, toMinStr('1 coins'))
        await dex.trade(token2.address, toMinStr('4 coins'), token1.address, accounts[0], accounts[1])
          .should.be.rejectedWith('exceeds allowance')
      })
    })

    describe('native <-> token', () => {
      it('native -> token2', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), ADDRESS_ZERO, accounts[0], accounts[1], {
          value: toMinStr('8 coins')
        })

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await balanceOf(dex.address).should.eventually.eq(toMinStr('8 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('native -> token2: excess input captured and ignored', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), ADDRESS_ZERO, accounts[0], accounts[1], {
          value: toMinStr('10 coins')
        })

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await balanceOf(dex.address).should.eventually.eq(toMinStr('10 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('input native token not enough', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), ADDRESS_ZERO, accounts[0], accounts[1], {
          value: toMinStr('7 coins')
        }).should.be.rejectedWith('input insufficient')
      })
    })
  })
})