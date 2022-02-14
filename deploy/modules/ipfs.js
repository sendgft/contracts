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

  const openedGftImg = await log.task('Upload "opened GFT" image to IPFS', async task => {
    const ret = await ipfsClient.uploadFile(GFT_OPENED_SVG, { verifyViaGateway: gateway })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  const unopenedGftImg = await log.task('Upload "unopened GFT" image to IPFS', async task => {
    const ret = await ipfsClient.uploadFile(GFT_UNOPENED_SVG, { verifyViaGateway: gateway })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  const card1 = await log.task('Upload "Card 1" html to IPFS', async task => {
    const ret = await ipfsClient.uploadFile(CARD_1_HTML, { verifyViaGateway: gateway })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  const card1ThumbnailImg = await log.task('Upload "Card 1 thumbnail" image to IPFS', async task => {
    const ret = await ipfsClient.uploadFile(CARD_1_THUMB_IMG, { verifyViaGateway: gateway })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  const gatewayUrl = cid => `${gateway}${cid}`

  const defaultMetadata = await log.task('Upload default metadata to IPFS', async task => {
    const ret = await ipfsClient.uploadJson({
      name: 'Unopened GFT',
      description: 'This is an unopened GFT sent via https://gft.xyz',
      image: gatewayUrl(unopenedGftImg.path),
    })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  const card1Metadata = await log.task('Upload card1 metadata to IPFS', async task => {
    const ret = await ipfsClient.uploadJson({
      name: 'Card1',
      description: 'This is default card 1 sent via https://gft.xyz',
      image: gatewayUrl(card1ThumbnailImg.path),
      external_url: gatewayUrl(card1.path),
    })
    await task.log(`CID: ${ret.cid}`)
    return ret
  })

  ctx.cids = {
    defaultMetadataCid: defaultMetadata.cid,
    openedGftImgCid: openedGftImg.cid,
    card1MetadataCid: card1Metadata.cid,
  }

  return ctx.cids
}