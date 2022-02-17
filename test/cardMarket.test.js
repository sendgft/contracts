import { EvmSnapshot, expect, extractEventArgs, getBalance, ADDRESS_ZERO } from './utils'
import { deployCardMarket } from '../deploy/modules/cardMarket'
import { getSigners, getContractAt } from '../deploy/utils'
import { events } from '..'

const DummyToken = artifacts.require("DummyToken")

describe('Card market', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let cardMarketDeployment
  let cardMarket
  let token1

  before(async () => {
    accounts = (await getSigners()).map(a => a.address)
    cardMarketDeployment = await deployCardMarket({ artifacts })
    cardMarket = await getContractAt({ artifacts }, 'CardMarketV1', cardMarketDeployment.proxy.address)
    token1 = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0)
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
      await cardMarket.upgradeTo(ADDRESS_ZERO, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('cannot upgrade to null address', async () => {
      await cardMarket.upgradeTo(ADDRESS_ZERO).should.be.rejectedWith('null implementation')
    })

    it('cannot upgrade to non-valid implementation', async () => {
      await cardMarket.upgradeTo(token1.address).should.be.rejectedWith('invalid implementation')
    })

    it('can upgrade to same implementation', async () => {
      await cardMarket.upgradeTo(cardMarketDeployment.impl.address).should.be.fulfilled
      await cardMarket.getAdmin().should.eventually.eq(accounts[0])
    })
  })

  describe('new card can be added', () => {
    it('but not by anyone', async () => {
      await cardMarket.addCard('test', ADDRESS_ZERO, 0, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('by an admin', async () => {
      await cardMarket.addCard('test', token1.address, 2).should.be.fulfilled
      await cardMarket.totalSupply().should.eventually.eq(1)
      await cardMarket.cards(1).should.eventually.matchObj({
        enabled: true,
        owner: accounts[0],
        contentHash: 'test',
        feeToken: token1.address,
        feeAmount: 2, 
      })
    })
  })

  describe('token URI', () => {
    beforeEach(async () => {
      await cardMarket.addCard('test', token1.address, 2)
    })

    it('must be a valid id', async () => {
      await cardMarket.tokenURI(2).should.be.rejectedWith('ERC721Metadata: URI query for nonexistent token')
    })

    describe('baseURI', async () => {
      it('returns with empty base URI', async () => {
        await cardMarket.tokenURI(1).should.eventually.eq('test')
      })

      it('base URI can be set, but not just by anyone', async () => {
        await cardMarket.setBaseURI('https://google.com', { from: accounts[2] }).should.be.rejectedWith('must be admin')
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