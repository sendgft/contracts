// @ts-nocheck
import { toMinStr, BigVal } from 'bigval'
import { artifacts } from 'hardhat'
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
    dex = await deployDummyDex()
    token1 = await DummyToken.new('Wrapped ETH 1', 'WETH1', 18, 0)
    token2 = await DummyToken.new('Wrapped ETH 2', 'WETH2', 18, 0)
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('check amounts', async () => {
    beforeEach(async () => {
      // 1 native token = 2 token2
      await dex.setPrice(
        token2.address, 
        toMinStr('2 coins'),
      )
    })

    it('native token -> token2', async () => {
      const amt = await dex.calcInAmount(token2.address, toMinStr('6 coins'))
      expect(new BigVal(amt).toString()).to.eq(toMinStr('3 coins'))
    })
  })

  describe('trade', async () => {
    beforeEach(async () => {
      // 1 native token = 2 token2
      await dex.setPrice(
        token2.address,
        toMinStr('2 coins'),
      )

      // 1 native token = 0.5 token2
      await dex.setPrice(
        token2.address,
        toMinStr('0.5 coins'),
      )

      await token1.mint(accounts[0], toMinStr('100 coins'))
      await token2.mint(accounts[0], toMinStr('100 coins'))

      await token2.transfer(dex.address, toMinStr('10 coins'))
      await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('10 coins'))
    })

    describe('native <-> token', () => {
      it('native -> token2', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), accounts[1], {
          value: toMinStr('8 coins')
        })

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await balanceOf(dex.address).should.eventually.eq(toMinStr('8 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('native -> token2: excess input captured and ignored', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), accounts[1], {
          value: toMinStr('10 coins')
        })

        await token2.balanceOf(dex.address).should.eventually.eq(toMinStr('6 coins'))
        await balanceOf(dex.address).should.eventually.eq(toMinStr('10 coins'))
        await token2.balanceOf(accounts[1]).should.eventually.eq(toMinStr('4 coins'))
      })

      it('input native token not enough', async () => {
        await dex.trade(token2.address, toMinStr('4 coins'), accounts[1], {
          value: toMinStr('7 coins')
        }).should.be.rejectedWith('input insufficient')
      })
    })
  })
})