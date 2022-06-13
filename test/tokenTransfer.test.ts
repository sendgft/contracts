// @ts-nocheck
import { BigVal, toMinStr } from 'bigval'
import { artifacts } from 'hardhat'

import { EvmSnapshot, ADDRESS_ZERO, extractEventArgs, expect, signCardApproval, createConfig } from './utils'
import { deployDummyTokens, deployDummyDex, deployGifter } from '../deploy/modules'
import { getSigners, getContractAt, Context } from '../deploy/utils'
import { events } from '../src'
import { TOKEN_TYPE } from '../src/constants'


describe('Token transfer', () => {
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

    // set price for testing
    await dex.setPrice(token1.address, toMinStr('2 coins'))

    const approvalSig = await signCardApproval(cardMarket, signers[0], 'test')

    await cardMarket.addCard({
      contentHash: 'test',
      fee: { tokenContract: token1.address, value: '0' }
    }, accounts[0], approvalSig)

    const approvalSig2 = await signCardApproval(cardMarket, signers[0], 'test2')

    await cardMarket.addCard({
      contentHash: 'test2',
      fee: { tokenContract: token1.address, value: '0' }
    }, accounts[0], approvalSig2)

    const approvalSig3 = await signCardApproval(cardMarket, signers[0], 'test3')

    await cardMarket.addCard({
      contentHash: 'test3',
      fee: { tokenContract: token1.address, value: '0' }
    }, accounts[0], approvalSig3)

    await gifter.create(
      {
        recipient: accounts[0],
        config: createConfig(1),
        message: 'The quick brown fox jumped over the lazy dog',
        weiValue: '0',
        fee: {
          tokenContract: token1.address,
          value: '0'
        },
        erc20: [],
        nft: [],
      },
      { value: '0' }
    )

    await gifter.create(
      {
        recipient: accounts[0],
        config: createConfig(2),
        message: 'The quick brown fox jumped over the lazy dog',
        weiValue: '0',
        fee: {
          tokenContract: token1.address,
          value: '0'
        },
        erc20: [],
        nft: [],
      },
      { value: '0' }
    )

    await gifter.create(
      {
        recipient: accounts[0],
        config: createConfig(3),
        message: 'The quick brown fox jumped over the lazy dog',
        weiValue: '0',
        fee: {
          tokenContract: token1.address,
          value: '0'
        },
        erc20: [],
        nft: [],
      },
      { value: '0' }
    )      
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('initial setup', async () => {
    // cards
    await tokenQuery.tokenOwner(1).should.eventually.eq(accounts[0])
    await tokenQuery.tokenOwner(2).should.eventually.eq(accounts[0])
    await tokenQuery.tokenOwner(3).should.eventually.eq(accounts[0])

    await tokenQuery.totalTokensByType(TOKEN_TYPE.CARD).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.CARD, accounts[0]).should.eventually.eq(3)

    // gifts
    await tokenQuery.tokenOwner(4).should.eventually.eq(accounts[0])
    await tokenQuery.tokenOwner(5).should.eventually.eq(accounts[0])
    await tokenQuery.tokenOwner(6).should.eventually.eq(accounts[0])

    await tokenQuery.totalTokensByType(TOKEN_TYPE.GIFT).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.GIFT, accounts[0]).should.eventually.eq(3)
  })

  it('single transfers are tracked', async () => {
    await erc1155.safeTransferFrom(accounts[0], accounts[1], 1, 1, []) // first card

    await tokenQuery.tokenOwner(1).should.eventually.eq(accounts[1])

    await tokenQuery.totalTokensByType(TOKEN_TYPE.CARD).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.CARD, accounts[0]).should.eventually.eq(2)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[0], 1).should.eventually.eq(3)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[0], 2).should.eventually.eq(2)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.CARD, accounts[1]).should.eventually.eq(1)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[1], 1).should.eventually.eq(1)

    await erc1155.safeTransferFrom(accounts[0], accounts[2], 6, 1, []) // last gift

    await tokenQuery.tokenOwner(6).should.eventually.eq(accounts[2])

    await tokenQuery.totalTokensByType(TOKEN_TYPE.GIFT).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.GIFT, accounts[0]).should.eventually.eq(2)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[0], 1).should.eventually.eq(4)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[0], 2).should.eventually.eq(5)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.GIFT, accounts[2]).should.eventually.eq(1)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[2], 1).should.eventually.eq(6)
  })

  it('batch transfers are tracked', async () => {
    await erc1155.safeBatchTransferFrom(accounts[0], accounts[1], [1, 2, 3, 4], [1, 1, 1, 1], []) // all cards and first gift

    await tokenQuery.tokenOwner(1).should.eventually.eq(accounts[1])
    await tokenQuery.tokenOwner(2).should.eventually.eq(accounts[1])
    await tokenQuery.tokenOwner(3).should.eventually.eq(accounts[1])
    await tokenQuery.tokenOwner(4).should.eventually.eq(accounts[1])
    await tokenQuery.tokenOwner(5).should.eventually.eq(accounts[0])
    await tokenQuery.tokenOwner(6).should.eventually.eq(accounts[0])

    await tokenQuery.totalTokensByType(TOKEN_TYPE.CARD).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.CARD, accounts[0]).should.eventually.eq(0)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.CARD, accounts[1]).should.eventually.eq(3)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[1], 1).should.eventually.eq(1)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[1], 2).should.eventually.eq(2)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.CARD, accounts[1], 3).should.eventually.eq(3)

    await tokenQuery.totalTokensByType(TOKEN_TYPE.GIFT).should.eventually.eq(3)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.GIFT, accounts[0]).should.eventually.eq(2)
    await tokenQuery.totalTokensOwnedByType(TOKEN_TYPE.GIFT, accounts[1]).should.eventually.eq(1)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[1], 1).should.eventually.eq(4)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[0], 1).should.eventually.eq(6)
    await tokenQuery.tokenOwnedByType(TOKEN_TYPE.GIFT, accounts[0], 2).should.eventually.eq(5)
  })
})