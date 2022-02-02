import path from 'path'
import { getIpfsClient } from '@sendgft/ipfs-tools'

import { createLog } from '../utils'

const ASSETS_PATH = path.join(__dirname, '..', '..', 'ipfs-assets')
const GFT_OPENED_SVG = path.join(ASSETS_PATH, 'gft-opened.svg')
const GFT_UNOPENED_SVG = path.join(ASSETS_PATH, 'gft-unopened.svg')

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

  const unopenedGfImgUrl = `${gateway}${unopenedGftImgCid}`

  const defaultMetadataCid = await log.task('Upload default metadata to IPFS', async task => {
    const cid = await ipfsClient.uploadJson({
      name: 'Unopened GFT',
      description: 'This is an unopened GFT sent via https://gft.xyz',
      image: unopenedGfImgUrl,
    })
    await task.log(`CID: ${cid}`)
    return cid
  })

  ctx.cids = {
    defaultMetadataCid,
    openedGftImgCid,
  }

  return ctx.cids
}