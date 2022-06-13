// @ts-nocheck
import { BigVal, toMinStr } from 'bigval'
import { artifacts } from 'hardhat'

import { EvmSnapshot, ADDRESS_ZERO, extractEventArgs, expect, signCardApproval, createConfig } from './utils'
import { deployCardMarket, deployDummyTokens, deployDummyDex, deployGifter } from '../deploy/modules'
import { getSigners, getContractAt, Context } from '../deploy/utils'
import { events } from '../src'
import { TokenType } from '../src/constants'

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
  let signers
  let accounts
  let gifterDeployment
  let gifter
  let erc1155
  let cardMarket
  let tokenQuery
  let dex
  let tokens
  let token1
  let randomToken

  before(async () => {
    signers = await getSigners()
    accounts = signers.map(a => a.address)
    tokens = await deployDummyTokens()
    token1 = tokens[0]
    dex = await deployDummyDex({}, { tokens })
    gifterDeployment = await deployGifter({ defaultSigner: signers[0] }, { dex, tokens })
    gifter = await getContractAt('IGifter', gifterDeployment.diamond.address)
    erc1155 = await getContractAt('ERC1155Facet', gifterDeployment.diamond.address)
    cardMarket = await getContractAt('ICardMarket', gifterDeployment.diamond.address)
    tokenQuery = await getContractAt('ITokenQuery', gifterDeployment.diamond.address)
    randomToken = await DummyToken.new('test', 'test', 18, 0)

    // set price for testing
    await dex.setPrice(token1.address, toMinStr('2 coins'))
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('allowed fee tokens', () => {
    it('can be set', async () => {
      await cardMarket.allowedFeeTokens().should.eventually.eq(tokens.map(t => t.address))
      await cardMarket.setAllowedFeeTokens([tokens[1].address])
      await cardMarket.allowedFeeTokens().should.eventually.eq([tokens[1].address])
      await cardMarket.setAllowedFeeTokens([tokens[2].address])
      await cardMarket.allowedFeeTokens().should.eventually.eq([tokens[2].address])
    })

    it('cannot be set by anon', async () => {
      await cardMarket.setAllowedFeeTokens([ tokens[1].address ], { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })
  })

  describe('tax', () => {
    it('can be set', async () => {
      await cardMarket.tax().should.eventually.eq('1000')
      await cardMarket.setTax('1')
      await cardMarket.tax().should.eventually.eq('1')
    })

    it('cannot be set by anon', async () => {
      await cardMarket.setTax('1', { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })
  })

  describe('new card can be added', () => {
    it('enabled by default', async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[0], approvalSig).should.be.fulfilled

      await tokenQuery.totalTokensByType(TokenType.CARD).should.eventually.eq(1)
      const id = await tokenQuery.tokenByType(TokenType.CARD, 1)

      expectCardDataToMatch(await cardMarket.card(id), {
        params: {
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
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[1], approvalSig).should.be.fulfilled

      await tokenQuery.totalTokensByType(TokenType.CARD).should.eventually.eq(1)
      const id = await tokenQuery.tokenByType(TokenType.CARD, 1)
      await tokenQuery.tokenOwner(id).should.eventually.eq(accounts[1])
    })

    it('not if admin approval is wrong', async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[1], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[0], approvalSig, { from: accounts[1] }).should.be.rejectedWith('must be approved by admin')
    })

    it('not if using disallowed fee token', async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: randomToken.address, value: 2 }
      }, accounts[0], approvalSig).should.be.rejectedWith('unsupported fee token')
    })

    it('but not if already added', async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[0], approvalSig).should.be.fulfilled

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 3 }
      }, accounts[0], approvalSig).should.be.rejectedWith('already added')
    })

    it('and event gets emitted', async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      const tx = await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[0], approvalSig).should.be.fulfilled

      const eventArgs = extractEventArgs(tx, events.AddCard)
      const totalCards = await tokenQuery.totalTokensByType(TokenType.CARD)
      const lastId = await tokenQuery.tokenByType(TokenType.CARD, totalCards)
      expect(eventArgs).to.include({ id: lastId.toString() })
    })
  })

  describe('card can be enabled and disabled', () => {
    beforeEach(async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[1], approvalSig)      
    })

    it('but not by non-owner', async () => {
      await cardMarket.setCardEnabled(1, false).should.be.rejectedWith('Gifter: must be owner')
    })

    it('but not if invalid', async () => {
      await cardMarket.setCardEnabled(2, false).should.be.rejectedWith('Gifter: must be owner')
    })

    it('if valid card', async () => {
      await cardMarket.card(1).should.eventually.matchObj({ enabled: true })
      await cardMarket.setCardEnabled(1, false, { from: accounts[1] })
      await cardMarket.card(1).should.eventually.matchObj({ enabled: false })
      await cardMarket.setCardEnabled(1, true, { from: accounts[1] })
      await cardMarket.card(1).should.eventually.matchObj({ enabled: true })
    })
  })

  describe('card fee can be changed', () => {
    beforeEach(async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[1], approvalSig)
    })

    it('but not by non-owner', async () => {
      await cardMarket.setCardFee(1, { tokenContract: token1.address, value: 3 }).should.be.rejectedWith('Gifter: must be owner')
    })

    it('but not if invalid', async () => {
      await cardMarket.setCardFee(2, { tokenContract: token1.address, value: 3 }).should.be.rejectedWith('Gifter: must be owner')
    })

    it('if valid card', async () => {
      await cardMarket.setCardFee(1, { tokenContract: token1.address, value: 3 }, { from: accounts[1] }).should.be.fulfilled

      expectCardDataToMatch(await cardMarket.card(1), {
        params: {
          fee: {
            tokenContract: token1.address,
            value: '3'
          }
        },
      })
    })
  })

  describe('card can be used', () => {
    let createGift
    let card1Id
    let card2Id

    beforeEach(async () => {
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: toMinStr('4 coins') }
      }, accounts[1], approvalSig)

      const approvalSig2 = await signCardApproval(cardMarket, signers[0], 'test2')

      await cardMarket.addCard({
        contentHash: 'test2',
        fee: { tokenContract: token1.address, value: toMinStr('10 coins') }
      }, accounts[2], approvalSig2)

      const totalCards = await tokenQuery.totalTokensByType(TokenType.CARD)
      card1Id = (await tokenQuery.tokenByType(TokenType.CARD, totalCards - 1)).toNumber()
      card2Id = (await tokenQuery.tokenByType(TokenType.CARD, totalCards)).toNumber()

      createGift = async (cardId, args = {}) => {
        return await gifter.create(
          {
            recipient: accounts[2],
            config: createConfig(cardId),
            message: 'The quick brown fox jumped over the lazy dog',
            weiValue: '0',
            fee: {
              tokenContract: token1.address,
              value: '0'
            },
            erc20: [],
            nft: [],
          },
          args
        )
      }
    })

    it('unless disabled', async () => {
      await cardMarket.setCardEnabled(card1Id, false, { from: accounts[1] })
      await createGift(card1Id, { value: '0' }).should.be.rejectedWith('not enabled')
    })

    describe('and fee gets paid', () => {
      it('unless not enough provided', async () => {
        // price: native/token1 = 2, thus for a fee of 4 token1, we need to send 2 native
        await createGift(card1Id, { value: toMinStr('1.9 coins') }).should.be.rejectedWith('input insufficient')
      })

      it('if enough provided', async () => {
        await createGift(card1Id, { value: toMinStr('2 coins') }).should.be.fulfilled
      })

      it('and event gets emitted', async () => {
        const tx = await createGift(card1Id, { value: toMinStr('2 coins') })

        const eventArgs = extractEventArgs(tx, events.UseCard)
        expect(eventArgs).to.include({ 
          cardId: '1',
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

        await createGift(card1Id, { value: toMinStr('2 coins') })
        await createGift(card2Id, { value: toMinStr('5 coins') })

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('1.4 coins'))
        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('12.6 coins'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('3.6 coins'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('9 coins'))
      })

      it('and tax can be withdrawn', async () => {
        await cardMarket.totalTaxes(token1.address).should.eventually.eq('0')

        await createGift(card1Id, { value: toMinStr('2 coins') })

        const preBal = BigVal.from(await token1.balanceOf(accounts[0]))

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('0.4 coins'))
        await cardMarket.withdrawTaxes(token1.address)
        await cardMarket.totalTaxes(token1.address).should.eventually.eq('0')

        const postBal = BigVal.from(await token1.balanceOf(accounts[0]))
        postBal.sub(preBal).toMinScale().toString().should.eql(toMinStr('0.4 coins'))

        await createGift(card2Id, { value: toMinStr('5 coins') })

        await cardMarket.totalTaxes(token1.address).should.eventually.eq(toMinStr('1 coins'))
      })

      it('and earnings can be withdrawn', async () => {
        await cardMarket.totalEarnings(token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[1], token1.address).should.eventually.eq(toMinStr('0'))
        await cardMarket.earnings(accounts[2], token1.address).should.eventually.eq(toMinStr('0'))

        await createGift(card1Id, { value: toMinStr('2 coins') })
        await createGift(card2Id, { value: toMinStr('5 coins') })

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
      const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

      await cardMarket.addCard({
        contentHash: 'test',
        fee: { tokenContract: token1.address, value: 2 }
      }, accounts[0], approvalSig)
    })

    it('must be a valid id', async () => {
      await erc1155.uri(2).should.be.rejectedWith('invalid token')
    })

    describe('baseURI', async () => {
      it('returns with empty base URI', async () => {
        await erc1155.uri(1).should.eventually.eq('test')
      })

      it('returns with non-empty base URI', async () => {
        await gifter.setBaseURI('https://smoke.some/')
        await erc1155.uri(1).should.eventually.eq('https://smoke.some/test')
      })
    })
  })
})