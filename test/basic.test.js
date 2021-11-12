import EthVal from 'ethval'
import { EvmSnapshot, expect, getBalance } from './utils'
import { getAccounts } from '../deploy/utils'

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
    sender1 = accounts[2]
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

  describe('successes', () => { 
    it('send a message', async () => {
      await gifter.send(
        receiver1,
        "test message",
        [],
        [],
        [],
        [],
        { from: sender1 }
      )

      await gifter.send(
        receiver2,
        "test message 2",
        [],
        [],
        [],
        [],
        { from: sender1 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(1)
      let id = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver1,
        message_: "test message",
        ethAsWei_: 0,
        erc20Contracts: [],
        erc20Amounts: [],
        nftContracts: [],
        nftTokenIds: []
      })

      await gifter.balanceOf(receiver2).should.eventually.eq(1)
      id = await gifter.tokenOfOwnerByIndex(receiver2, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver2,
        message_: "test message 2",
        ethAsWei_: 0,
        erc20Contracts: [],
        erc20Amounts: [],
        nftContracts: [],
        nftTokenIds: []
      })
    })

    it('send eth', async () => {
      await gifter.send(
        receiver1,
        "test message",
        [],
        [],
        [],
        [],
        { from: sender1, value: 100 }
      )

      await gifter.send(
        receiver2,
        "test message 2",
        [],
        [],
        [],
        [],
        { from: sender1, value: 200 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(1)
      let id = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver1,
        message_: "test message",
        ethAsWei_: 100,
      })

      await gifter.balanceOf(receiver2).should.eventually.eq(1)
      id = await gifter.tokenOfOwnerByIndex(receiver2, 0)
      await gifter.getGift(id).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver2,
        message_: "test message 2",
        ethAsWei_: 200,
      })
    })

    it('send eth and erc20, and claim', async () => {
      await token1.mint({ value: 10, from: sender1 })
      await token2.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 10, { from: sender1 })

      await gifter.send(
        receiver1,
        "test message",
        [token1.address, token2.address],
        [3, 4],
        [],
        [],
        { from: sender1, value: 45 }
      )

      await gifter.send(
        receiver1,
        "test message 2",
        [token2.address],
        [2],
        [],
        [],
        { from: sender1, value: 20 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(2)
      const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.getGift(gift1).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver1,
        message_: "test message",
        ethAsWei_: 45,
        erc20Contracts: [token1.address, token2.address],
        erc20Amounts: [3, 4],
        nftContracts: [],
        nftTokenIds: []
      })

      const gift2 = await gifter.tokenOfOwnerByIndex(receiver1, 1)
      await gifter.getGift(gift2).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver1,
        message_: "test message 2",
        ethAsWei_: 20,
        erc20Contracts: [token2.address],
        erc20Amounts: [2],
        nftContracts: [],
        nftTokenIds: []
      })

      // check token balances
      await token1.balanceOf(gifter.address).should.eventually.eq(3)
      await token2.balanceOf(gifter.address).should.eventually.eq(6)
      await getBalance(gifter.address).should.eventually.eq(65)
      await token1.balanceOf(receiver1).should.eventually.eq(0)
      await token2.balanceOf(receiver1).should.eventually.eq(0)
      const preBal = new EthVal(await getBalance(receiver1))

      // claim
      const tx = await gifter.claim(gift1, { from: receiver1 })
      const gasPrice = new EthVal(tx.receipt.effectiveGasPrice)
      const gasUsed = new EthVal(tx.receipt.cumulativeGasUsed)
      const gasCost = gasUsed.mul(gasPrice)

      // check gifts
      await gifter.getGift(gift1).should.eventually.matchObj({
        sender_: sender1,
        claimed_: true,
        recipient_: receiver1,
        message_: "test message",
        ethAsWei_: 45,
        erc20Contracts: [token1.address, token2.address],
        erc20Amounts: [3, 4],
        nftContracts: [],
        nftTokenIds: []
      })
      await gifter.getGift(gift2).should.eventually.matchObj({
        sender_: sender1,
        claimed_: false,
        recipient_: receiver1,
        message_: "test message 2",
        ethAsWei_: 20,
        erc20Contracts: [token2.address],
        erc20Amounts: [2],
        nftContracts: [],
        nftTokenIds: []
      })

      // check balances
      await token1.balanceOf(gifter.address).should.eventually.eq(0)
      await token2.balanceOf(gifter.address).should.eventually.eq(2)
      await getBalance(gifter.address).should.eventually.eq(20)
      await token1.balanceOf(receiver1).should.eventually.eq(3)
      await token2.balanceOf(receiver1).should.eventually.eq(4)
      const postBal = new EthVal(await getBalance(receiver1))
      expect(postBal.sub(preBal.sub(gasCost)).toNumber()).to.eq(45)
    })
  })

  describe('failures', () => {
    it('send nothing', async () => {
      await gifter.send(
        receiver1,
        "",
        [],
        [],
        [],
        [],
        { from: sender1 }
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
        [],
        { from: sender1 }
      ).should.be.rejectedWith('exceeds allowance')
    })

    it('send erc20 where balance is insufficient', async () => {
      await token1.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 5, { from: sender1 })

      await gifter.send(
        receiver1,
        "test message",
        [token1.address, token2.address],
        [10, 5],
        [],
        [],
        { from: sender1 }
      ).should.be.rejectedWith('exceeds balance')
    })

    it('claim invalid gift id', async () => {
      await gifter.claim(2).should.be.rejectedWith('nonexistent ')
    })

    it('claim when not owner', async () => {
      await gifter.send(
        receiver1,
        "test message",
        [],
        [],
        [],
        [],
        { from: sender1 }
      )

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.claim(gift).should.be.rejectedWith('must be owner')
    })

    it('claim when already claimed', async () => {
      await token1.mint({ value: 3, from: sender1 })
      await token1.approve(gifter.address, 3, { from: sender1 })

      await gifter.send(
        receiver1,
        "test message",
        [token1.address],
        [3],
        [],
        [],
        { from: sender1 }
      )

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.claim(gift, { from: receiver1 })
      await gifter.claim(gift, { from: receiver1 }).should.be.rejectedWith('already claimed')
    })
  })
})