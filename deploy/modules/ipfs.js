import path from 'path'
import { getIpfsClient } from '@sendgft/ipfs-tools'

import { createLog } from '../utils'

const ASSETS_PATH = path.join(__dirname, '..', '..', 'ipfs-assets')
const GFT_OPENED_SVG = path.join(ASSETS_PATH, 'gft-opened.svg')
const GFT_UNOPENED_SVG = path.join(ASSETS_PATH, 'gft-unopened.svg')
const CARD_1_HTML = path.join(ASSETS_PATH, 'card1.html')
const CARD_1_THUMB_IMG = path.join(ASSETS_PATH, 'card1-thumbnail.png')

export const deployIpfsAssets = async (ctx) => {
  const { log = createLog(), deployConfig: { ipfs: { api, gateway } } } = ctx

  const ipfsClient = getIpfsClient(api)

  const openedGftImgCid = await log.task('Upload "opened GFT" image to IPFS', async task => {
    const cid = await ipfsClient.uploadFile(GFT_OPENED_SVG, { verifyViaGateway: gateway })
    await task.log(`CID: ${cid}`)
    return cid
  })

  const unopenedGftImgCid = await log.task('Upload "unopened GFT" image to IPFS', async task => {
    const cid = await ipfsClient.uploadFile(GFT_UNOPENED_SVG, { verifyViaGateway: gateway })
    await task.log(`CID: ${cid}`)
    return cid
  })

  const card1Cid = await log.task('Upload "Card 1" html to IPFS', async task => {
    const cid = await ipfsClient.uploadFile(CARD_1_HTML, { verifyViaGateway: gateway })
    await task.log(`CID: ${cid}`)
    return cid
  })

  const card1ThumbnailImgCid = await log.task('Upload "Card 1 thumbnail" image to IPFS', async task => {
    const cid = await ipfsClient.uploadFile(CARD_1_THUMB_IMG, { verifyViaGateway: gateway })
    await task.log(`CID: ${cid}`)
    return cid
  })

  const gatewayUrl = cid => `${gateway}${cid}`

  const defaultMetadataCid = await log.task('Upload default metadata to IPFS', async task => {
    const cid = await ipfsClient.uploadJson({
      name: 'Unopened GFT',
      description: 'This is an unopened GFT sent via https://gft.xyz',
      image: gatewayUrl(unopenedGftImgCid),
    })
    await task.log(`CID: ${cid}`)
    return cid
  })

  const card1MetadataCid = await log.task('Upload card1 metadata to IPFS', async task => {
    const cid = await ipfsClient.uploadJson({
      name: 'Card1',
      description: 'This is default card 1 sent via https://gft.xyz',
      image: gatewayUrl(card1ThumbnailImgCid),
      external_url: gatewayUrl(card1Cid),
    })
    await task.log(`CID: ${cid}`)
    return cid
  })

  ctx.cids = {
    defaultMetadataCid,
    openedGftImgCid,
    card1MetadataCid,
  }

  return ctx.cids
}