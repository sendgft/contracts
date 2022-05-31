#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { argv } = require('yargs')
const { getIpfsClient } = require('@sendgft/ipfs-tools')

;(async () => {
  const { api, gateway } = argv

  const ipfs = getIpfsClient(api)

  const { cid, path: fPath } = await ipfs.uploadFile(path.join(__dirname, '../public/lib/shared.js'), {
    verifyViaGateway: gateway,
    wrapWithDirectory: true,
  })

  const url = `${gateway}${fPath}`

  console.log(`Uploaded to: ${url}`)

  if (api.startsWith('pinata://')) {
    const fp = path.join(__dirname, '../deployed.json')

    console.log(`Writing: ${fp}`)

    fs.writeFileSync(fp, JSON.stringify({
      cid,
      url,
    }, null, 2), 'utf-8')
  }

})().catch(err => {
  console.error(err)
  process.exit(-1)
})
