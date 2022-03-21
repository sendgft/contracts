import { BigVal, toMinStr } from 'bigval'
import { EvmSnapshot, expect, extractEventArgs, balanceOf, ADDRESS_ZERO } from './utils'
import { deployGifter, deployCardMarket, deployDummyDex, deployDummyTokens } from '../deploy/modules'
import { getSigners, getContractAt } from '../deploy/utils'
import { events } from '..'

const DummyNFT = artifacts.require("DummyNFT")

const expectGiftDataToMatch = (ret, exp) => {
  expect(ret).to.matchObj({
    sender: exp.sender,
    created: exp.createrd,
    claimed: exp.claimed,
    opened: exp.opened,
    contentHash: exp.contentHash,
  })
  if (exp.params) {
    expect(ret.params).to.matchObj({
      recipient: exp.params.recipient,
      config: exp.params.config,
      weiValue: exp.params.weiValue,
    })

    if (exp.params.erc20) {
      Object.keys(exp.params.erc20).forEach(k => {
        expect(exp.params.erc20[k].tokenContract).to.eq(ret.params.erc20[k].tokenContract)
        expect(exp.params.erc20[k].value).to.eq(ret.params.erc20[k].value)
      })
    }
    if (exp.params.nft) {
      Object.keys(exp.params.nft).forEach(k => {
        expect(exp.params.nft[k].tokenContract).to.eq(ret.params.nft[k].tokenContract)
        expect(exp.params.nft[k].value).to.eq(ret.params.nft[k].value)
      })
    }
  }
}

describe('Gifter', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts
  let dex
  let cardMarketDeployment
  let cardMarket
  let gifterDeployment
  let gifter
  let nft1
  let token1
  let token2
  let sender1
  let receiver1
  let receiver2

  before(async () => {
    accounts = (await getSigners()).map(a => a.address)
    const tokens = await deployDummyTokens({ artifacts })
    token1 = tokens[0]
    token2 = tokens[1]
    dex = await deployDummyDex({ artifacts }, { tokens })
    cardMarketDeployment = await deployCardMarket({ artifacts }, { dex, tokens })
    cardMarket = await getContractAt({ artifacts }, 'CardMarketV1', cardMarketDeployment.proxy.address)
    gifterDeployment = await deployGifter({ artifacts }, { cardMarket })
    gifter = await getContractAt({ artifacts }, 'GifterV1', gifterDeployment.proxy.address)
    nft1 = await DummyNFT.new()
    sender1 = accounts[2]
    receiver1 = accounts[5]
    receiver2 = accounts[6]

    // set price for testing
    await dex.setPrice(ADDRESS_ZERO, token1.address, toMinStr('2 coins'), toMinStr('0.5 coins'))

    // add card designs
    await cardMarket.addCard({ 
      contentHash: "test1", 
      fee: {
        tokenContract: token1.address, 
        value: '0',
      }
    })
    await cardMarket.setCardApproved(1, true)

    await cardMarket.addCard({
      contentHash: "test2",
      fee: {
        tokenContract: token2.address,
        value: toMinStr('10 coins'),
      }
    })
    await cardMarket.setCardApproved(2, true)
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

  it('returns card market', async () => {
    await gifter.cardMarket().should.eventually.eq(cardMarket.address)
  })

  it('returns admin', async () => {
    await gifter.getAdmin().should.eventually.eq(accounts[0])
  })

  describe('upgrades', () => {
    it('cannot be done by randoms', async () => {
      await gifter.upgradeTo(ADDRESS_ZERO, { from: accounts[1] }).should.be.rejectedWith('ProxyImpl: must be admin')
    })

    it('cannot upgrade to null address', async () => {
      await gifter.upgradeTo(ADDRESS_ZERO).should.be.rejectedWith('ProxyImpl: null implementation')
    })

    it('cannot upgrade to non-valid implementation', async () => {
      await gifter.upgradeTo(nft1.address).should.be.rejectedWith('ProxyImpl: invalid implementation')
    })

    it('can upgrade to same implementation', async () => {
      await gifter.upgradeTo(gifterDeployment.impl.address).should.be.fulfilled
      await gifter.getAdmin().should.eventually.eq(accounts[0])
    })
  })

  describe('successes', () => { 
    it('send eth', async () => {
      const tx1 = await gifter.create(
        {
          recipient: receiver1,
          config: '0x01',
          message: 'msg1',
          weiValue: '100',
          fee: {
            tokenContract: ADDRESS_ZERO,
            value: '0',
          },
          erc20: [],
          nft: [],
        }, 
        { from: sender1, value: 100 }
      )

      const tx2 = await gifter.create(
        {
          recipient: receiver2,
          config: '0x01',
          message: 'msg2',
          weiValue: '200',
          fee: {
            tokenContract: ADDRESS_ZERO,
            value: '0',
          },
          erc20: [],
          nft: [],
        }, 
        { from: sender1, value: 200 }
      )

      await gifter.balanceOf(receiver1).should.eventually.eq(1)
      let id = await gifter.tokenOfOwnerByIndex(receiver1, 0)
      let ret = await gifter.gifts(id)
      expectGiftDataToMatch(ret, {
        sender: sender1,
        created: tx1.receipt.blockNumber,
        claimed: 0,
        opened: false,
        contentHash: '',
        params: {
          recipient: receiver1,
          config: '0x01',
          weiValue: '100',
          erc20: [],
          nft: [],
        }
      })

      await gifter.balanceOf(receiver2).should.eventually.eq(1)
      id = await gifter.tokenOfOwnerByIndex(receiver2, 0)
      ret = await gifter.gifts(id)
      expectGiftDataToMatch(ret, {
        sender: sender1,
        created: tx2.receipt.blockNumber,
        claimed: 0,
        opened: false,
        contentHash: '',
        params: {
          recipient: receiver2,
          config: '0x01',
          weiValue: '200',
          erc20: [],
          nft: [],
        }
      })
    })

    describe('send eth and erc20 and NFTs', async () => {
      beforeEach(async () => {
        await token1.mint(sender1, 10)
        await token2.mint(sender1, 10)

        await token1.approve(gifter.address, 10, { from: sender1 })
        await token2.approve(gifter.address, 10, { from: sender1 })

        await nft1.mint(sender1)
        await nft1.approve(gifter.address, 1, { from: sender1 })

        await gifter.create(
          {
            recipient: receiver1,
            config: '0x01',
            message: 'msg1',
            weiValue: '45',
            fee: {
              tokenContract: ADDRESS_ZERO,
              value: '0',
            },
            erc20: [
              {
                tokenContract: token1.address,
                value: '3'
              },
              {
                tokenContract: token2.address,
                value: '4'
              },
            ],
            nft: [
              {
                tokenContract: nft1.address,
                value: '1'
              },
            ],
          },
          { from: sender1, value: 45 }
        )

        await gifter.create(
          {
            recipient: receiver1,
            config: '0x01',
            message: 'msg1',
            weiValue: '20',
            fee: {
              tokenContract: ADDRESS_ZERO,
              value: '0',
            },
            erc20: [
              {
                tokenContract: token2.address,
                value: '2'
              }
            ],
            nft: [],
          },
          { from: sender1, value: 20 }
        )
      })

      it('and open and claim', async () => {
        await gifter.balanceOf(receiver1).should.eventually.eq(2)

        const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)
        expectGiftDataToMatch(await gifter.gifts(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: '0x01',
            weiValue: '45',
            erc20: [
              {
                tokenContract: token1.address,
                value: '3'
              },
              {
                tokenContract: token2.address,
                value: '4'
              },
            ],
            nft: [
              {
                tokenContract: nft1.address,
                value: '1'
              },
            ],
          }
        })

        const gift2 = await gifter.tokenOfOwnerByIndex(receiver1, 1)
        expectGiftDataToMatch(await gifter.gifts(gift2), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: '0x01',
            weiValue: '20',
            erc20: [
              {
                tokenContract: token2.address,
                value: '2'
              },
            ],
            nft: [],
          }
        })

        // check token balances
        await token1.balanceOf(gifter.address).should.eventually.eq(3)
        await token2.balanceOf(gifter.address).should.eventually.eq(6)
        await balanceOf(gifter.address).should.eventually.eq(65)
        await nft1.ownerOf(1).should.eventually.eq(gifter.address)
        await token1.balanceOf(receiver1).should.eventually.eq(0)
        await token2.balanceOf(receiver1).should.eventually.eq(0)
        const preBal = BigVal.from(await balanceOf(receiver1))

        // claim
        const tx = await gifter.openAndClaim(gift1, 'content1', { from: receiver1 })
        const gasPrice = BigVal.from(tx.receipt.effectiveGasPrice)
        const gasUsed = BigVal.from(tx.receipt.cumulativeGasUsed)
        const gasCost = gasUsed.mul(gasPrice)

        // check event
        const eventArgs = extractEventArgs(tx, events.Claimed)
        expect(eventArgs).to.include({ tokenId: gift1.toString() })

        // check gifts
        expectGiftDataToMatch(await gifter.gifts(gift1), {
          claimed: tx.receipt.blockNumber,
          opened: true,
          contentHash: 'content1',
        })
        expectGiftDataToMatch(await gifter.gifts(gift2), {
          claimed: 0,
          opened: false,
        })

        // check balances
        await token1.balanceOf(gifter.address).should.eventually.eq(0)
        await token2.balanceOf(gifter.address).should.eventually.eq(2)
        await balanceOf(gifter.address).should.eventually.eq(20)
        await nft1.ownerOf(1).should.eventually.eq(receiver1)
        await token1.balanceOf(receiver1).should.eventually.eq(3)
        await token2.balanceOf(receiver1).should.eventually.eq(4)
        const postBal = BigVal.from(await balanceOf(receiver1))
        expect(postBal.sub(preBal.sub(gasCost)).toNumber()).to.eq(45)
      })

      it('and claim without opening', async () => {
        await gifter.balanceOf(receiver1).should.eventually.eq(2)

        const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)
        expectGiftDataToMatch(await gifter.gifts(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: '0x01',
            weiValue: '45',
            erc20: [
              {
                tokenContract: token1.address,
                value: '3'
              },
              {
                tokenContract: token2.address,
                value: '4'
              },
            ],
            nft: [
              {
                tokenContract: nft1.address,
                value: '1'
              },
            ],
          }
        })

        // check token balances
        await token1.balanceOf(gifter.address).should.eventually.eq(3)
        await token2.balanceOf(gifter.address).should.eventually.eq(6)
        await balanceOf(gifter.address).should.eventually.eq(65)
        await nft1.ownerOf(1).should.eventually.eq(gifter.address)
        await token1.balanceOf(receiver1).should.eventually.eq(0)
        await token2.balanceOf(receiver1).should.eventually.eq(0)
        const preBal = BigVal.from(await balanceOf(receiver1))

        // claim
        const tx = await gifter.claim(gift1, { from: receiver1 })
        const gasPrice = BigVal.from(tx.receipt.effectiveGasPrice)
        const gasUsed = BigVal.from(tx.receipt.cumulativeGasUsed)
        const gasCost = gasUsed.mul(gasPrice)

        // check event
        const eventArgs = extractEventArgs(tx, events.Claimed)
        expect(eventArgs).to.include({ tokenId: gift1.toString() })

        // check gifts
        await gifter.gifts(gift1).should.eventually.matchObj({
          claimed: tx.receipt.blockNumber,
          opened: false,
          contentHash: '',
        })

        // check balances
        await token1.balanceOf(gifter.address).should.eventually.eq(0)
        await token2.balanceOf(gifter.address).should.eventually.eq(2)
        await balanceOf(gifter.address).should.eventually.eq(20)
        await nft1.ownerOf(1).should.eventually.eq(receiver1)
        await token1.balanceOf(receiver1).should.eventually.eq(3)
        await token2.balanceOf(receiver1).should.eventually.eq(4)
        const postBal = BigVal.from(await balanceOf(receiver1))
        expect(postBal.sub(preBal.sub(gasCost)).toNumber()).to.eq(45)
      })

      it('and claim without opening, then open and claim later', async () => {
        await gifter.balanceOf(receiver1).should.eventually.eq(2)

        const gift1 = await gifter.tokenOfOwnerByIndex(receiver1, 0)
        expectGiftDataToMatch(await gifter.gifts(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: '0x01',
            weiValue: '45',
            erc20: [
              {
                tokenContract: token1.address,
                value: '3'
              },
              {
                tokenContract: token2.address,
                value: '4'
              },
            ],
            nft: [
              {
                tokenContract: nft1.address,
                value: '1'
              },
            ],
          }
        })

        // check token balances
        await token1.balanceOf(gifter.address).should.eventually.eq(3)
        await token2.balanceOf(gifter.address).should.eventually.eq(6)
        await balanceOf(gifter.address).should.eventually.eq(65)
        await nft1.ownerOf(1).should.eventually.eq(gifter.address)
        await token1.balanceOf(receiver1).should.eventually.eq(0)
        await token2.balanceOf(receiver1).should.eventually.eq(0)
        const preBal = BigVal.from(await balanceOf(receiver1))

        // claim
        const tx = await gifter.claim(gift1, { from: receiver1 })
        let gasPrice = BigVal.from(tx.receipt.effectiveGasPrice)
        let gasUsed = BigVal.from(tx.receipt.cumulativeGasUsed)
        const gasCost1 = gasUsed.mul(gasPrice)

        // open and claim
        const tx2 = await gifter.openAndClaim(gift1, 'hash1', { from: receiver1 })
        gasPrice = BigVal.from(tx2.receipt.effectiveGasPrice)
        gasUsed = BigVal.from(tx2.receipt.cumulativeGasUsed)
        const gasCost2 = gasUsed.mul(gasPrice)

        // check gifts
        await gifter.gifts(gift1).should.eventually.matchObj({
          claimed: tx.receipt.blockNumber,
          opened: true,
          contentHash: 'hash1',
        })

        // check balances
        await token1.balanceOf(gifter.address).should.eventually.eq(0)
        await token2.balanceOf(gifter.address).should.eventually.eq(2)
        await balanceOf(gifter.address).should.eventually.eq(20)
        await nft1.ownerOf(1).should.eventually.eq(receiver1)
        await token1.balanceOf(receiver1).should.eventually.eq(3)
        await token2.balanceOf(receiver1).should.eventually.eq(4)
        const postBal = BigVal.from(await balanceOf(receiver1))
        expect(postBal.sub(preBal.sub(gasCost1).sub(gasCost2)).toNumber()).to.eq(45)
      })
    })


    it('emits event with message text when creating', async () => {
      const tx = await gifter.create(
        {
          recipient: receiver1,
          config: '0x01',
          message: 'The quick brown fox jumped over the lazy dog',
          weiValue: '100',
          fee: {
            tokenContract: ADDRESS_ZERO,
            value: '0',
          },
          erc20: [],
          nft: [],
        },
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

  describe.only('paying card fee', () => {
    let createGift

    beforeEach(async () => {
      createGift = async (props = {}, args = {}) => {
        await gifter.create(
          {
            recipient: receiver1,
            config: '0x02', // 2nd card requires a fee of 10 TOKEN1 (=20 ETH)
            message: 'The quick brown fox jumped over the lazy dog',
            weiValue: 100,
            fee: {
              tokenContract: ADDRESS_ZERO,
              value: '0',
            },
            erc20: [],
            nft: [],
            ...props,
          },
          { from: sender1, value: 100, ...args }  
        )
      }
    })

    it('fails if not enough given', async () => {
      await createGift()
    })
  })

  describe('failures', () => {
    let createGift

    beforeEach(async () => {
      createGift = async ({ erc20 = [], nft = [] } = {}) => {
        await gifter.create(
          {
            recipient: receiver1,
            config: '0x01',
            message: 'The quick brown fox jumped over the lazy dog',
            weiValue: '100',
            fee: {
              tokenContract: ADDRESS_ZERO,
              value: '0',
            },
            erc20,
            nft,
          },
          { from: sender1, value: 100 }
        )
      }
    })
    it('send when card design is disabled', async () => {
      await cardMarket.setCardEnabled(1, false)
      await createGift().should.be.rejectedWith('card not enabled')
    })

    it('send when card design is no approved', async () => {
      await cardMarket.setCardApproved(1, false)
      await createGift().should.be.rejectedWith('card not approved')
    })

    it('send erc20 where gifter is not approved', async () => {
      await token1.mint(sender1, 10)
      await token2.mint(sender1, 10)

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 9, { from: sender1 })

      await createGift({
        erc20: [
          {
            tokenContract: token1.address,
            value: 10,
          },
          {
            tokenContract: token2.address,
            value: 10,
          },
        ]
      }).should.be.rejectedWith('exceeds allowance')
    })

    it('send erc20 where balance is insufficient', async () => {
      await token1.mint(sender1, 10)

      await token1.approve(gifter.address, 10, { from: sender1 })
      await token2.approve(gifter.address, 5, { from: sender1 })

      await createGift({
        erc20: [
          {
            tokenContract: token1.address,
            value: 10,
          },
          {
            tokenContract: token2.address,
            value: 5,
          },
        ]
      }).should.be.rejectedWith('exceeds balance')
    })

    it('send nft where id is invalid', async () => {
      await createGift({
        nft: [
          {
            tokenContract: nft1.address,
            value: 5,
          },
        ]
      }).should.be.rejectedWith('nonexistent token')
    })

    it('send nft where gifter is not approved', async () => {
      await nft1.mint(sender1)

      await createGift({
        nft: [
          {
            tokenContract: nft1.address,
            value: 1,
          },
        ]
      }).should.be.rejectedWith('not owner nor approved')
    })

    it('claim invalid gift id', async () => {
      await gifter.openAndClaim(2, 'content1').should.be.rejectedWith('nonexistent')
    })

    it('claim when not owner', async () => {
      await createGift()

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.openAndClaim(gift, 'content1').should.be.rejectedWith('NftBase: must be owner')
    })

    it('open and claim when already done so', async () => {
      await token1.mint(sender1, 3)
      await token1.approve(gifter.address, 3, { from: sender1 })

      await createGift()

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.openAndClaim(gift, 'content1', { from: receiver1 })
      await gifter.openAndClaim(gift, 'content1', { from: receiver1 }).should.be.rejectedWith('Gifter: already opened')
    })

    it('claim without opening when already done so', async () => {
      await token1.mint(sender1, 3)
      await token1.approve(gifter.address, 3, { from: sender1 })

      await createGift()

      const gift = await gifter.tokenOfOwnerByIndex(receiver1, 0)

      await gifter.claim(gift, { from: receiver1 })
      await gifter.claim(gift, { from: receiver1 }).should.be.rejectedWith('Gifter: already claimed')
    })
  })

  describe('token URI', () => {
    let createGift
    let tokenId
    
    beforeEach(async () => {
      createGift = async () => {
        await gifter.create(
          {
            recipient: receiver1,
            config: '0x01',
            message: 'The quick brown fox jumped over the lazy dog',
            weiValue: '100',
            fee: {
              tokenContract: ADDRESS_ZERO,
              value: '0',
            },
            erc20: [],
            nft: [],
          },
          { from: sender1, value: 100 }
        )

        tokenId = (await gifter.lastId()).toNumber()
      }
    })

    it('must be a valid id', async () => {
      await createGift()
      await gifter.tokenURI(tokenId + 1).should.be.rejectedWith('NftBase: URI query for nonexistent token')
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