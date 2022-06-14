#!/usr/bin/env node

/* This script generates the deployment config */

const fs = require('fs')
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const { PINATA_API_KEY, PINATA_SECRET } = process.env

const projectDir = path.join(__dirname, '..')
const deployConfigFile = path.join(projectDir, 'deployConfig.json')

async function main() {
  console.log(`Uploading to IPFS ...`)

  let api
  let gateway

  switch (argv.network) {
    case 'localhost':
      api = 'http://127.0.0.1:5001/api/v0'
      gateway = 'http://127.0.0.1:5002/ipfs/'
      break
    case 'goerli':
    case 'avax':
      api = `pinata://${PINATA_API_KEY}:${PINATA_SECRET}`,
      gateway = 'https://ipfs.gft.xyz/ipfs/'
      break
    default:
      throw new Error(`Unsupported network: ${argv.network}`)
  }

  const releaseInfo = {
    network: argv.network,
    deployDummyTokens: (['localhost', 'goerli'].includes(argv.network)),
    ipfs: {
      api,
      gateway,
    }
  }

  if (argv.network === 'localhost') {
    releaseInfo.isLocalDevnet = true
  }

  if (argv.network === 'goerli') {
    releaseInfo.verifyOnEtherscan = true
  }

  fs.writeFileSync(deployConfigFile, JSON.stringify(releaseInfo, null, 2), 'utf8')

  console.log(`Deploy config created:

${JSON.stringify(releaseInfo, null, 2)}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })