// @ts-nocheck
import { BigVal, toMinStr } from 'bigval'
import { artifacts } from 'hardhat'

import { EvmSnapshot, expect, extractEventArgs, balanceOf, ADDRESS_ZERO, signCardApproval, createConfig } from './utils'
import { deployGifter, deployCardMarket, deployDummyDex, deployDummyTokens } from '../deploy/modules'
import { getSigners, getContractAt, Context } from '../deploy/utils'
import { FacetCutAction, getSelectors } from '../deploy/utils/diamond'
import { events } from '../src'
import { TokenType  } from '../src/constants'

const DummyNFT = artifacts.require("DummyNFT")
const TestFacet1 = artifacts.require("TestFacet1")
const TestFacet2 = artifacts.require("TestFacet2")

const expectGiftDataToMatch = (ret, exp) => {
  expect(ret).to.matchObj({
    sender: exp.sender,
    created: exp.created,
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
  let signers
  let accounts
  let dex
  let gifterDeployment
  let gifter
  let cutter
  let cardMarket
  let erc1155
  let tokenQuery
  let testFacet1
  let testFacet2
  let nft1
  let token1
  let token2
  let sender1
  let receiver1
  let receiver2

  let freeCardId
  let paidCardId

  before(async () => {
    signers = await getSigners()
    accounts = signers.map(a => a.address)
    const tokens = await deployDummyTokens()
    token1 = tokens[0]
    token2 = tokens[1]
    dex = await deployDummyDex({}, { tokens })
    gifterDeployment = await deployGifter({ defaultSigner: signers[0] }, { dex, tokens })
    gifter = await getContractAt('IGifter', gifterDeployment.diamond.address)
    erc1155 = await getContractAt('ERC1155Facet', gifterDeployment.diamond.address)
    cutter = await getContractAt('IDiamondCut', gifterDeployment.diamond.address)
    cardMarket = await getContractAt('ICardMarket', gifterDeployment.diamond.address)
    tokenQuery = await getContractAt('ITokenQuery', gifterDeployment.diamond.address)
    nft1 = await DummyNFT.new()
    testFacet1 = await TestFacet1.new()
    testFacet2 = await TestFacet2.new()
    sender1 = accounts[2]
    receiver1 = accounts[5]
    receiver2 = accounts[6]

    // set price for testing: 1 ETH = 2 TOKENS
    await dex.setPrice(token2.address, toMinStr('2 coins'))

    // add card designs
    const approvalSig = await signCardApproval(cardMarket, signers[0], 'test1')
    let tx = await cardMarket.addCard({ 
      contentHash: "test1", 
      fee: {
        tokenContract: token1.address, 
        value: '0',
      }
    }, accounts[0], approvalSig)

    freeCardId = extractEventArgs(tx, events.AddCard).id
    console.log(`Free card id: ${freeCardId}`)

    const approvalSig2 = await signCardApproval(cardMarket, signers[0], 'test2')
    tx = await cardMarket.addCard({
      contentHash: "test2",
      fee: {
        tokenContract: token2.address,
        value: toMinStr('10 coins'),
      }
    }, accounts[0], approvalSig2)

    paidCardId = extractEventArgs(tx, events.AddCard).id
    console.log(`Paid card id: ${paidCardId}`)
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('upgrades', () => {
    it('cannot be done by randoms', async () => {
      await cutter.diamondCut([], ADDRESS_ZERO, [], { from: accounts[1] }).should.be.rejectedWith('Must be contract owner')
    })

    it('add and/or replace methods', async () => {
      const testFacet = await getContractAt('ITestFacet', gifterDeployment.diamond.address)

      // add
      await cutter.diamondCut(
        [
          {
            facetAddress: testFacet1.address,
            action: FacetCutAction.AddOrReplace,
            functionSelectors: getSelectors(testFacet1),
          }
        ], 
        ADDRESS_ZERO, 
        [], 
      )

      await testFacet.getTestUint().should.eventually.eq(123)

      // replace
      await cutter.diamondCut(
        [
          {
            facetAddress: testFacet2.address,
            action: FacetCutAction.AddOrReplace,
            functionSelectors: getSelectors(testFacet2),
          }
        ],
        ADDRESS_ZERO,
        [],
      )

      await testFacet.getTestUint().should.eventually.eq(456)
    })
  })

  describe('successes', () => { 
    it('send eth', async () => {
      const tx1 = await gifter.create(
        {
          recipient: receiver1,
          config: createConfig(freeCardId),
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
          config: createConfig(freeCardId),
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

      await tokenQuery.totalTokensOwnedByType(TokenType.GIFT, receiver1).should.eventually.eq(1)
      let id = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)
      let ret = await gifter.gift(id)
      expect(ret.timestamp).not.to.eq(0)
      expectGiftDataToMatch(ret, {
        sender: sender1,
        created: tx1.receipt.blockNumber,
        claimed: 0,
        opened: false,
        contentHash: '',
        params: {
          recipient: receiver1,
          config: createConfig(freeCardId),
          weiValue: '100',
          erc20: [],
          nft: [],
        }
      })

      await tokenQuery.totalTokensOwnedByType(TokenType.GIFT, receiver2).should.eventually.eq(1)
      id = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver2, 1)
      ret = await gifter.gift(id)
      expectGiftDataToMatch(ret, {
        sender: sender1,
        created: tx2.receipt.blockNumber,
        claimed: 0,
        opened: false,
        contentHash: '',
        params: {
          recipient: receiver2,
          config: createConfig(freeCardId),
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
            config: createConfig(freeCardId),
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
            config: createConfig(freeCardId),
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
        await tokenQuery.totalTokensOwnedByType(TokenType.GIFT, receiver1).should.eventually.eq(2)

        const gift1 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)
        expectGiftDataToMatch(await gifter.gift(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: createConfig(freeCardId),
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

        const gift2 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 2)
        expectGiftDataToMatch(await gifter.gift(gift2), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: createConfig(freeCardId),
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
        expect(eventArgs).to.include({ id: gift1.toString() })

        // check gifts
        expectGiftDataToMatch(await gifter.gift(gift1), {
          claimed: tx.receipt.blockNumber,
          opened: true,
          contentHash: 'content1',
        })
        expectGiftDataToMatch(await gifter.gift(gift2), {
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
        await tokenQuery.totalTokensOwnedByType(TokenType.GIFT, receiver1).should.eventually.eq(2)

        const gift1 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)
        expectGiftDataToMatch(await gifter.gift(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: createConfig(freeCardId),
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
        expect(eventArgs).to.include({ id: gift1.toString() })

        // check gifts
        await gifter.gift(gift1).should.eventually.matchObj({
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
        await tokenQuery.totalTokensOwnedByType(TokenType.GIFT, receiver1).should.eventually.eq(2)

        const gift1 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)
        expectGiftDataToMatch(await gifter.gift(gift1), {
          sender: sender1,
          claimed: 0,
          opened: false,
          contentHash: '',
          params: {
            recipient: receiver1,
            config: createConfig(freeCardId),
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
        await gifter.gift(gift1).should.eventually.matchObj({
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
          config: createConfig(freeCardId),
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

      const gift1 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)

      // check event
      const eventArgs = extractEventArgs(tx, events.Created)
      expect(eventArgs).to.include({ 
        id: gift1.toString(),
        message: 'The quick brown fox jumped over the lazy dog'
      })
    })

    it('updates sender info', async () => {
      await gifter.totalSent(sender1).should.eventually.eq(0)

      const _s1 = async () => {
        return gifter.create(
          {
            recipient: receiver1,
            config: createConfig(freeCardId),
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
      }

      await _s1()
      const gift1 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)
      await gifter.totalSent(sender1).should.eventually.eq(1)
      await gifter.sent(sender1, 0).should.eventually.eq(gift1.toString())

      await _s1()
      const gift2 = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 2)
      await gifter.totalSent(sender1).should.eventually.eq(2)
      await gifter.sent(sender1, 1).should.eventually.eq(gift2.toString())
    })
  })

  describe('paying card fee', () => {
    let createGift

    beforeEach(async () => {
      createGift = async (props = {}, args = {}) => {
        await gifter.create(
          {
            recipient: receiver1,
            config: createConfig(paidCardId), // 2nd card requires a fee of 10 TOKEN1 (=20 ETH)
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
      await createGift().should.be.rejectedWith('input insufficient')

      await createGift({
        weiValue: '0',
      }, {
        value: toMinStr('4.9 coins'), // 5 needed for fee
      }).should.be.rejectedWith('input insufficient')
    })

    it('passes if enough given', async () => {
      const preBal = BigVal.from(await token2.balanceOf(dex.address))
      await token2.balanceOf(cardMarket.address).should.eventually.eq('0')
      await balanceOf(dex.address).should.eventually.eq('0')
      await balanceOf(gifter.address).should.eventually.eq('0')

      await createGift({
        weiValue: '0',
      }, {
        value: toMinStr('20 coins'), // 20 ETH swap to 10 tokens
      })

      const postBal = BigVal.from(await token2.balanceOf(dex.address))
      expect(preBal.sub(postBal)).to.eq(toMinStr('10 coins'))
      await token2.balanceOf(cardMarket.address).should.eventually.eq(toMinStr('10 coins'))
      await balanceOf(dex.address).should.eventually.eq(toMinStr('20 coins'))
      await balanceOf(gifter.address).should.eventually.eq('0')
    })

    it('ensures eth for the gift is saved properly', async () => {
      const preBal = BigVal.from(await token2.balanceOf(dex.address))
      await token2.balanceOf(cardMarket.address).should.eventually.eq('0')
      await balanceOf(dex.address).should.eventually.eq('0')
      await balanceOf(gifter.address).should.eventually.eq('0')

      await createGift({
        weiValue: '100',
      }, {
        value: BigVal.fromStr('20 coins').toMinScale().add(100).toString(), // 20 ETH swap to 10 tokens
      })

      const postBal = BigVal.from(await token2.balanceOf(dex.address))
      expect(preBal.sub(postBal)).to.eq(toMinStr('10 coins'))
      await token2.balanceOf(cardMarket.address).should.eventually.eq(toMinStr('10 coins'))
      await balanceOf(dex.address).should.eventually.eq(toMinStr('20 coins'))
      await balanceOf(gifter.address).should.eventually.eq('100')
    })
  })

  describe('failures', () => {
    let createGift

    beforeEach(async () => {
      createGift = async ({ erc20 = [], nft = [] } = {}) => {
        await gifter.create(
          {
            recipient: receiver1,
            config: createConfig(freeCardId),
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
      await gifter.openAndClaim(25666, 'content1').should.be.rejectedWith('Gifter: must be owner')
    })

    it('claim when not owner', async () => {
      await createGift()

      const id = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)

      await gifter.openAndClaim(id, 'content1').should.be.rejectedWith('Gifter: must be owner')
    })

    it('open and claim when already done so', async () => {
      await token1.mint(sender1, 3)
      await token1.approve(gifter.address, 3, { from: sender1 })

      await createGift()

      const id = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)

      await gifter.openAndClaim(id, 'content1', { from: receiver1 })
      await gifter.openAndClaim(id, 'content1', { from: receiver1 }).should.be.rejectedWith('Gifter: already opened')
    })

    it('claim without opening when already done so', async () => {
      await token1.mint(sender1, 3)
      await token1.approve(gifter.address, 3, { from: sender1 })

      await createGift()

      const id = await tokenQuery.tokenOwnedByType(TokenType.GIFT, receiver1, 1)

      await gifter.claim(id, { from: receiver1 })
      await gifter.claim(id, { from: receiver1 }).should.be.rejectedWith('Gifter: already claimed')
    })

    it('claim without opening but id is invalid', async () => {
      await gifter.claim(256666, { from: receiver1 }).should.be.rejectedWith('Gifter: must be owner')
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
            config: createConfig(freeCardId),
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

        const totalGifts = await tokenQuery.totalTokensByType(TokenType.GIFT)
        tokenId = (await tokenQuery.tokenByType(TokenType.GIFT, totalGifts)).toNumber()
      }
    })

    it('must be a valid id', async () => {
      await createGift()
      await erc1155.uri(tokenId + 1).should.be.rejectedWith('invalid token')
    })

    describe('baseURI', async () => {
      beforeEach(async () => {
        await gifter.setDefaultGiftContentHash('foo')
        await createGift()
      })

      it('returns with empty base URI', async () => {
        await erc1155.uri(tokenId).should.eventually.eq('foo')
      })

      it('base URI can be set, but not just by anyone', async () => {
        await gifter.setBaseURI('https://google.com', { from: accounts[2] }).should.be.rejectedWith('Gifter: must be admin')
      })

      it('base URI can be set by admin', async () => {
        await gifter.setBaseURI('https://google.com').should.be.fulfilled
      })

      it('returns with non-empty base URI', async () => {
        await gifter.setBaseURI('https://smoke.some/')
        await erc1155.uri(tokenId).should.eventually.eq('https://smoke.some/foo')
      })
    })

    describe('default content hash', async () => {
      beforeEach(async () => {
        await gifter.setBaseURI('bar/')
      })

      it('returns with empty content hash', async () => {
        await createGift()
        await erc1155.uri(tokenId).should.eventually.eq('bar/')
      })

      it('content hash can be set, but not just by anyone', async () => {
        await gifter.setDefaultGiftContentHash('foo', { from: accounts[2] }).should.be.rejectedWith('Gifter: must be admin')
      })

      it('content hash can be set by admin', async () => {
        await gifter.setDefaultGiftContentHash('foo').should.be.fulfilled
        await gifter.defaultGiftContentHash().should.eventually.eq('foo')
      })

      it('returns with non-empty base URI', async () => {
        await gifter.setDefaultGiftContentHash('foo')
        await createGift()
        await erc1155.uri(tokenId).should.eventually.eq('bar/foo')
      })
    })

    describe('once claimed', async () => {
      beforeEach(async () => {
        await gifter.setBaseURI('bar/')
        await gifter.setDefaultGiftContentHash('foo')
        await createGift()
      })

      it('returns with new content hash once claimed', async () => {
        await gifter.openAndClaim(tokenId, 'foo2', { from: receiver1 })
        await erc1155.uri(tokenId).should.eventually.eq('bar/foo2')
      })
    })
  })
})