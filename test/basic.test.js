import EthVal from 'ethval'
import { EvmSnapshot, expect, extractEventArgs, getBalance } from './utils'
import { deployGifter } from '../deploy/modules/gifter'
import { getAccounts, getContractAt } from '../deploy/utils'
import { events } from '../'

const DummyToken = artifacts.require("DummyToken")
const DummyNFT = artifacts.require("DummyNFT")

const stringToBytesHex = s => hre.ethers.utils.hexlify(hre.ethers.utils.toUtf8Bytes(s))

describe('Gifter', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let gifter
  let nft1
  let token1
  let token2
  let sender1
  let receiver1
  let receiver2

  before(async () => {
    accounts = await getAccounts()
    const { proxy } = await deployGifter({ artifacts })
    gifter = await getContractAt({ artifacts }, 'GifterImplementationV1', proxy.address)
    nft1 = await DummyNFT.new()
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
    it('send eth', async () => {
      await gifter.create(
        receiver1,
        stringToBytesHex('hash1'),
        'msg1',
        0,
        [],
        [],
        { from: sender1, value: 100 }
      )

      await gifter.create(
        receiver2,
        stringToBytesHex('hash2'),
        'msg2',
        0,
        [],
        [],
        { from: sender1, value: 200 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(1)
      let id = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.giftsV1(id).should.eventually.matchObj({
        sender: sender1,
        config: stringToBytesHex('hash1'),
        contentHash: '',
        claimed: false,
        recipient: receiver1,
        ethAsWei: 100,
        numErc20s: 0,
      })

      await gifter.balanceOf(receiver2).should.eventually.eq(1)
      id = await gifter.tokenOfOwnerByIndex(receiver2, 0)
      await gifter.giftsV1(id).should.eventually.matchObj({
        sender: sender1,
        config: stringToBytesHex('hash2'),
        contentHash: '',
        claimed: false,
        recipient: receiver2,
        ethAsWei: 200,
        numErc20s: 0,
      })
    })

    it('send eth and erc20 and NFTs, and claim', async () => {
      await token1.mint({ value: 10, from: sender1 })
      await token2.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 10, { from: sender1 })

      await nft1.mint({ from: sender1 })
      await nft1.approve(gifter.address, 1, { from: sender1 })

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        2,
        [token1.address, token2.address, nft1.address],
        [3, 4, 1],
        { from: sender1, value: 45 }
      )

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        1,
        [token2.address],
        [2],
        { from: sender1, value: 20 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(2)
      const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      await gifter.giftsV1(gift1).should.eventually.matchObj({
        sender: sender1,
        claimed: false,
        config: stringToBytesHex('hash'),
        recipient: receiver1,
        ethAsWei: 45,
        numErc20s: 2,
        erc20AndNftContracts: [token1.address, token2.address],
        amountsAndIds: [3, 4],
      })

      const gift2 = await gifter.tokenOfOwnerByIndex(receiver1, 1)
      await gifter.giftsV1(gift2).should.eventually.matchObj({
        sender: sender1,
        claimed: false,
        config: stringToBytesHex('hash'),
        recipient: receiver1,
        ethAsWei: 20,
        numErc20s: 1,
        erc20AndNftContracts: [token2.address, nft1.address],
        amountsAndIds: [2, 1],
      })

      // check token balances
      await token1.balanceOf(gifter.address).should.eventually.eq(3)
      await token2.balanceOf(gifter.address).should.eventually.eq(6)
      await getBalance(gifter.address).should.eventually.eq(65)
      await nft1.ownerOf(1).should.eventually.eq(gifter.address)
      await token1.balanceOf(receiver1).should.eventually.eq(0)
      await token2.balanceOf(receiver1).should.eventually.eq(0)
      const preBal = new EthVal(await getBalance(receiver1))

      // claim
      const tx = await gifter.openAndClaim(gift1, 'content1', { from: receiver1 })
      const gasPrice = new EthVal(tx.receipt.effectiveGasPrice)
      const gasUsed = new EthVal(tx.receipt.cumulativeGasUsed)
      const gasCost = gasUsed.mul(gasPrice)

      // check event
      const eventArgs = extractEventArgs(tx, events.Claimed)
      expect(eventArgs).to.include({ tokenId: gift1.toString() })

      // check gifts
      await gifter.giftsV1(gift1).should.eventually.matchObj({
        sender: sender1,
        claimed: true,
        contentHash: 'content1',
        recipient: receiver1,
        ethAsWei: 45,
        numErc20s: 2,
        erc20AndNftContracts: [token1.address, token2.address, nft1.address],
        amountsAndIds: [3, 4, 1],
      })
      await gifter.giftsV1(gift2).should.eventually.matchObj({
        sender: sender1,
        claimed: false,
        recipient: receiver1,
        ethAsWei: 20,
        numErc20s: 1,
        erc20AndNftContracts: [token2.address],
        amountsAndIds: [2],
      })

      // check balances
      await token1.balanceOf(gifter.address).should.eventually.eq(0)
      await token2.balanceOf(gifter.address).should.eventually.eq(2)
      await getBalance(gifter.address).should.eventually.eq(20)
      await nft1.ownerOf(1).should.eventually.eq(receiver1)
      await token1.balanceOf(receiver1).should.eventually.eq(3)
      await token2.balanceOf(receiver1).should.eventually.eq(4)
      const postBal = new EthVal(await getBalance(receiver1))
      expect(postBal.sub(preBal.sub(gasCost)).toNumber()).to.eq(45)
    })

    it('emits event with message text when creating', async () => {
      const tx = await gifter.create(
        receiver1,
        stringToBytesHex('hash1'),
        'The quick brown fox jumped over the lazy dog',
        0,
        [],
        [],
        { from: sender1, value: 100 }
      )

      const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      // check event
      const eventArgs = extractEventArgs(tx, events.Created)
      expect(eventArgs).to.include({ 
        tokenId: gift1.toString(),
        message: 'The quick brown fox jumped over the lazy dog'
      })
    })
  })

  describe('failures', () => {
    it('send erc20 where gifter is not approved', async () => {
      await token1.mint({ value: 10, from: sender1 })
      await token2.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 9, { from: sender1 })

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        2,
        [token1.address, token2.address],
        [10, 10],
        { from: sender1 }
      ).should.be.rejectedWith('exceeds allowance')
    })

    it('send erc20 where balance is insufficient', async () => {
      await token1.mint({ value: 10, from: sender1 })

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 5, { from: sender1 })

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        2,
        [token1.address, token2.address],
        [10, 5],
        { from: sender1 }
      ).should.be.rejectedWith('exceeds balance')
    })

    it('send nft where id is invalid', async () => {
      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        0,
        [nft1.address],
        [5],
        { from: sender1 }
      ).should.be.rejectedWith('ERC721: operator query for nonexistent token')
    })

    it('send nft where gifter is not approved', async () => {
      await nft1.mint({ from: sender1 })

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        0,
        [nft1.address],
        [1],
        { from: sender1 }
      ).should.be.rejectedWith('ERC721: transfer caller is not owner nor approved')
    })

    it('claim invalid gift id', async () => {
      await gifter.openAndClaim(2, 'content1').should.be.rejectedWith('nonexistent ')
    })

    it('claim when not owner', async () => {
      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        0,
        [],
        [],
        { from: sender1 }
      )

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.openAndClaim(gift, 'content1').should.be.rejectedWith('must be owner')
    })

    it('claim when already claimed', async () => {
      await token1.mint({ value: 3, from: sender1 })
      await token1.approve(gifter.address, 3, { from: sender1 })

      await gifter.create(
        receiver1,
        stringToBytesHex('hash'),
        'msg1',
        1,
        [token1.address],
        [3],
        { from: sender1 }
      )

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.openAndClaim(gift, 'content1', { from: receiver1 })
      await gifter.openAndClaim(gift, 'content1', { from: receiver1 }).should.be.rejectedWith('already claimed')
    })
  })

  describe('token URI', () => {
    let createGift
    let tokenId
    
    beforeEach(async () => {
      createGift = async () => {
        await gifter.create(
          receiver1,
          stringToBytesHex('hash'),
          'msg1',
          0,
          [],
          [],
          { from: sender1, value: 100 }
        )

        tokenId = (await gifter.lastGiftId()).toNumber()
      }
    })

    it('must be a valid id', async () => {
      await createGift()
      await gifter.tokenURI(tokenId + 1).should.be.rejectedWith('ERC721Metadata: URI query for nonexistent token')
    })

    describe('baseURI', async () => {
      beforeEach(async () => {
        await gifter.setDefaultContentHash('foo')
        await createGift()
      })

      it('returns with empty base URI', async () => {
        await gifter.tokenURI(tokenId).should.eventually.eq('foo')
      })

      it('base URI can be set, but not just by anyone', async () => {
        await gifter.setBaseURI('https://google.com', { from: accounts[2] }).should.be.rejectedWith('must be admin')
      })

      it('base URI can be set by admin', async () => {
        await gifter.setBaseURI('https://google.com').should.be.fulfilled
      })

      it('returns with non-empty base URI', async () => {
        await gifter.setBaseURI('https://smoke.some/')
        await gifter.tokenURI(tokenId).should.eventually.eq('https://smoke.some/foo')
      })
    })

    describe('default content hash', async () => {
      beforeEach(async () => {
        await gifter.setBaseURI('bar/')
      })

      it('returns with empty content hash', async () => {
        await createGift()
        await gifter.tokenURI(tokenId).should.eventually.eq('bar/')
      })

      it('content hash can be set, but not just by anyone', async () => {
        await gifter.setDefaultContentHash('foo', { from: accounts[2] }).should.be.rejectedWith('must be admin')
      })

      it('content hash can be set by admin', async () => {
        await gifter.setDefaultContentHash('foo').should.be.fulfilled
      })

      it('returns with non-empty base URI', async () => {
        await gifter.setDefaultContentHash('foo')
        await createGift()
        await gifter.tokenURI(tokenId).should.eventually.eq('bar/foo')
      })
    })

    describe('once claimed', async () => {
      beforeEach(async () => {
        await gifter.setBaseURI('bar/')
        await gifter.setDefaultContentHash('foo')
        await createGift()
      })

      it('returns with new content hash once claimed', async () => {
        await gifter.openAndClaim(tokenId, 'foo2', { from: receiver1 })
        await gifter.tokenURI(tokenId).should.eventually.eq('bar/foo2')
      })
    })
  })
})