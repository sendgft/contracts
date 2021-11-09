import { EvmSnapshot } from './utils'
import { getAccounts } from '../deploy/utils'
import { expect } from 'chai'

const Gifter = artifacts.require("Gifter")
const DummyToken = artifacts.require("DummyToken")

describe('Gifter', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let gifter
  let token1
  let token2
  let sender1
  let receiver1
  let receiver2

  before(async () => {
    accounts = await getAccounts()
    gifter = await Gifter.new()
    token1 = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0)
    token2 = await DummyToken.new('Wrapped AVAX', 'WAVAX', 18, 0)
    sender1 = accounts[1]
    receiver1 = accounts[5]
    receiver2 = accounts[6]
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('returns version', async () => {
    await gifter.getVersion().should.eventually.eq('1')
  })

  describe('failures', () => {
    it('send nothing', async () => {
      await gifter.send(
        receiver1,
        "",
        [],
        [],
        [],
        []
      ).should.be.rejectedWith('empty message')
    })

    it('send erc20 where one is not approved', async () => {
      await token1.mint({ value: 10, from: sender1 })
      await token2.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 9, { from: sender1 })

      await gifter.send(
        receiver1,
        "test message",
        [token1.address, token2.address],
        [10, 10],
        [],
        []
      ).should.be.rejectedWith('exceeds allowance')
    })

    it('send erc20 where balance is insufficient', async () => {
      await token1.mint({ value: 10, from: sender1 })
      await token2.mint({ value: 5, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 10, { from: sender1 })

      await gifter.send(
        receiver1,
        "test message",
        [token1.address, token2.address],
        [10, 10],
        [],
        []
      ).should.be.rejectedWith('exceeds allowance')
    })
  })

  describe('successes', () => { 
    it.only('send a message', async () => {
      await gifter.send(
        receiver1,
        "test message",
        [],
        [],
        [],
        []
      )

      await gifter.send(
        receiver2,
        "test message 2",
        [],
        [],
        [],
        []
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(1)
      let id = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        claimed_: false,
        recipient_: receiver1,
        message_: "test message",
        erc20Contracts: [],
        erc20Amounts: [],
        nftContracts: [],
        nftTokenIds: []
      })

      await gifter.balanceOf(receiver2).should.eventually.eq(1)
      id = await gifter.tokenOfOwnerByIndex(receiver2, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        claimed_: false,
        recipient_: receiver2,
        message_: "test message 2",
        erc20Contracts: [],
        erc20Amounts: [],
        nftContracts: [],
        nftTokenIds: []
      })
    })
  })
})