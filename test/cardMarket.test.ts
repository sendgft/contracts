// @ts-nocheck
import { BigVal, toMinStr } from 'bigval'
import { artifacts } from 'hardhat'

import { EvmSnapshot, ADDRESS_ZERO, extractEventArgs, expect } from './utils'
import { deployCardMarket, deployDummyTokens, deployDummyDex } from '../deploy/modules'
import { getSigners, getContractAt, Context } from '../deploy/utils'
import { events } from '../src'

const DummyToken = artifacts.require("DummyToken")

const expectCardDataToMatch = (ret, exp) => {
  expect(ret).to.matchObj({
    enabled: exp.enabled,
  })
  if (exp.params) {
    expect(ret.params).to.matchObj({
      owner: exp.params.owner,
      contentHash: exp.params.contentHash
    })
    if (exp.params.fee) {
      expect(ret.params.fee).to.matchObj({
        tokenContract: exp.params.fee.tokenContract,
        value: exp.params.fee.value,
      })
    }
  }
}


describe('Card market', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let cardMarketDeployment
  let cardMarket
  let dex
  let tokens
  let token1
  let randomToken

  before(async () => {
    accounts = (await getSigners()).map(a => a.address)
    tokens = await deployDummyTokens()
    token1 = tokens[0]
    dex = await deployDummyDex({}, { tokens })
    cardMarketDeployment = await deployCardMarket({}, { dex, tokens })
    cardMarket = await getContractAt('CardMarketV1', cardMarketDeployment.proxy.address)
    randomToken = await DummyToken.new('test', 'test', 18, 0)

    // set price for testing
    await dex.setPrice(ADDRESS_ZERO, token1.address, toMinStr('2 coins'), toMinStr('0.5 coins'))
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('returns version', async () => {
    await cardMarket.getVersion().should.eventually.eq('1')
  })

  it('returns admin', async () => {
    await cardMarket.getAdmin().should.eventually.eq(accounts[0])
  })

  describe('upgrades', () => {
    it('cannot be done by randoms', async () => {
      await cardMarket.upgradeTo(ADDRESS_ZERO, { from: accounts[1] }).should.be.rejectedWith('ProxyImpl: must be admin')
    })

    it('cannot upgrade to null address', async () => {
      await cardMarket.upgradeTo(ADDRESS_ZERO).should.be.rejectedWith('ProxyImpl: null implementation')
    })

    it('cannot upgrade to non-valid implementation', async () => {
      await cardMarket.upgradeTo(token1.address).should.be.rejectedWith('ProxyImpl: invalid implementation')
    })

    it('can upgrade to same implementation', async () => {
      await cardMarket.upgradeTo(cardMarketDeployment.impl.address).should.be.fulfilled
      await cardMarket.getAdmin().should.eventually.eq(accounts[0])
    })
  })

  describe('allowed fee tokens', () => {
    it('can be set', async () => {
      await cardMarket.allowedFeeTokens().should.eventually.eq(tokens.map(t => t.address))
      await cardMarket.setAllowedFeeTokens([ tokens[1].address ])
      await cardMarket.allowedFeeTokens().should.eventually.eq([ tokens[1].address ])
      await cardMarket.setAllowedFeeTokens([tokens[2].address])
      await cardMarket.allowedFeeTokens().should.eventually.eq([tokens[2].address])
    })
  })

  describe('tax', () => {
    it('can be set', async () => {
      await cardMarket.tax().should.eventually.eq('1000')
      await cardMarket.setTax('1')
      await cardMarket.tax().should.eventually.eq('1')
    })
  })

  describe('new card can be added', () => {
    it('enabled by default', async () => {
      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }).should.be.fulfilled

      await cardMarket.totalSupply().should.eventually.eq(1)

      expectCardDataToMatch(await cardMarket.card(1), {
        params: {
          owner: accounts[0],
          contentHash: 'test',
          fee: {
            tokenContract: token1.address,
            value: '2'
          }
        },
        enabled: true,
      })
    })

    it('and owner can be set', async () => {
      await cardMarket.addCard({
        owner: accounts[1],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }).should.be.fulfilled

      expectCardDataToMatch(await cardMarket.card(1), {
        params: {
          owner: accounts[1],
        },
        enabled: true,
      })
    })

    it('not if by non-admin', async () => {
      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: randomToken.address, value: 2 }
      }, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('not if using disallowed fee token', async () => {
      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: randomToken.address, value: 2 }
      }).should.be.rejectedWith('unsupported fee token')
    })

    it('but not if already added', async () => {
      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }).should.be.fulfilled

      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 3 }
      }).should.be.rejectedWith('CardMarket: already added')
    })

    it('and event gets emitted', async () => {
      const tx = await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }).should.be.fulfilled

      const eventArgs = extractEventArgs(tx, events.AddCard)
      expect(eventArgs).to.include({ tokenId: (await cardMarket.lastId()).toString() })
    })
  })

  describe('card can be enabled and disabled', () => {
    beforeEach(async () => {
      await cardMarket.addCard({
        owner: accounts[1],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      })      
    })

    it('but not by non-owner', async () => {
      await cardMarket.setCardEnabled(1, false).should.be.rejectedWith('NftBase: must be owner')
    })

    it('but not if invalid', async () => {
      await cardMarket.setCardEnabled(2, false).should.be.rejectedWith('nonexistent')
    })

    it('if valid card', async () => {
      await cardMarket.card(1).should.eventually.matchObj({ enabled: true })
      await cardMarket.setCardEnabled(1, false, { from: accounts[1] })
      await cardMarket.card(1).should.eventually.matchObj({ enabled: false })
      await cardMarket.setCardEnabled(1, true, { from: accounts[1] })
      await cardMarket.card(1).should.eventually.matchObj({ enabled: true })
    })
  })

  describe('card can be used', () => {
    beforeEach(async () => {
      await cardMarket.addCard({
        owner: accounts[1],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: toMinStr('4 coins') }
      })

      await cardMarket.addCard({
        owner: accounts[2],
        contentHash: 'test2',
        fee: { tokenContract: token1.address, value: toMinStr('10 coins') }
      })
    })

    it('unless disabled', async () => {
      await cardMarket.setCardEnabled(1, false, { from: accounts[1] })
      await cardMarket.useCard(1).should.be.rejectedWith('not enabled')
    })

    describe('and fee gets paid', () => {
      it('unless not enough provided', async () => {
        // price: native/token1 = 2, thus for a fee of 4 token1, we need to send 2 native
        await cardMarket.useCard(1, { value: toMinStr('1.9 coins') }).should.be.rejectedWith('input insufficient')
      })

      it('if enough provided', async () => {
        await cardMarket.useCard(1, { value: toMinStr('2 coins') }).should.be.fulfilled
      })

      it('and event getes emitted', async () => {
        const tx = await cardMarket.useCard(1, { value: toMinStr('2 coins') }).should.be.fulfilled

        const eventArgs = extractEventArgs(tx, events.UseCard)
        expect(eventArgs).to.include({ 
          tokenId: '1',
          fee: toMinStr('4 coins'),
          earned: toMinStr('3.6 coins'),
          // tax: toMinStr('0.4 coins'),
        })
      })

      it('and tax and earnings get calculated', async () => {
        await cardMarket.tax().should.eventually.eq('1000') // 10%
        await cardMarket.totalTaxes(token1.address).should.eventually.eq('0')
        await cardMarket.totalEarnings(token1.address).should.eventually.eq('0')
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq('0')
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq('0')

        await cardMarket.useCard(1, { value: toMinStr('2 coins') })
        await cardMarket.useCard(2, { value: toMinStr('5 coins') })

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('1.4 coins'))
        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('12.6 coins'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('3.6 coins'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('9 coins'))
      })

      it('and tax can be withdrawn', async () => {
        await cardMarket.totalTaxes(token1.address).should.eventually.eq('0')

        await cardMarket.useCard(1, { value: toMinStr('2 coins') })

        const preBal = BigVal.from(await token1.balanceOf(accounts[0]))

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('0.4 coins'))
        await cardMarket.withdrawTaxes(token1.address)
        await cardMarket.totalTaxes(token1.address).should.eventually.eq('0')

        const postBal = BigVal.from(await token1.balanceOf(accounts[0]))
        postBal.sub(preBal).toMinScale().toString().should.eql(toMinStr('0.4 coins'))

        await cardMarket.useCard(2, { value: toMinStr('5 coins') })

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('1 coins'))
      })

      it('and earnings can be withdrawn', async () => {
        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('0'))

        await cardMarket.useCard(1, { value: toMinStr('2 coins') })
        await cardMarket.useCard(2, { value: toMinStr('5 coins') })

        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('12.6 coins'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('3.6 coins'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('9 coins'))

        const preBal1 = BigVal.from(await token1.balanceOf(accounts[1]))

        await cardMarket.withdrawEarnings(token1.address, { from: accounts[1] })

        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('9 coins'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('9 coins'))

        const postBal1 = BigVal.from(await token1.balanceOf(accounts[1]))
        postBal1.sub(preBal1).toMinScale().toString().should.eql(toMinStr('3.6 coins'))

        const preBal2 = BigVal.from(await token1.balanceOf(accounts[2]))

        await cardMarket.withdrawEarnings(token1.address, { from: accounts[2] })

        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('0'))

        const postBal2 = BigVal.from(await token1.balanceOf(accounts[2]))
        postBal2.sub(preBal2).toMinScale().toString().should.eql(toMinStr('9 coins'))
      })
    })
  })

  describe('token URI', () => {
    beforeEach(async () => {
      await cardMarket.addCard({
        owner: accounts[0],
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      })
    })

    it('must be a valid id', async () => {
      await cardMarket.tokenURI(2).should.be.rejectedWith('NftBase: URI query for nonexistent token')
    })

    describe('baseURI', async () => {
      it('returns with empty base URI', async () => {
        await cardMarket.tokenURI(1).should.eventually.eq('test')
      })

      it('base URI can be set, but not just by anyone', async () => {
        await cardMarket.setBaseURI('https://google.com', { from: accounts[2] }).should.be.rejectedWith('ProxyImpl: must be admin')
      })

      it('base URI can be set by admin', async () => {
        await cardMarket.setBaseURI('https://google.com').should.be.fulfilled
      })

      it('returns with non-empty base URI', async () => {
        await cardMarket.setBaseURI('https://smoke.some/')
        await cardMarket.tokenURI(1).should.eventually.eq('https://smoke.some/test')
      })
    })
  })
})