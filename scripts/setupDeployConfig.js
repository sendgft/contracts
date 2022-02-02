#!/usr/bin/env node

/* This script generates the deployment config */

const fs = require('fs')
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { getMeta, execute } = require('@sendgft/ipfs-tools/dist/cjs/cli/commands/upload-defaults')
const argv = yargs(hideBin(process.argv)).argv

const { PINATA_API_KEY, PINATA_SECRET } = process.env

const projectDir = path.join(__dirname, '..')
const deployConfigFile = path.join(projectDir, 'deployConfig.json')

const ipfsDataDir = path.join(projectDir, 'node_modules', '@sendgft', 'ipfs-tools', 'data')

async function main() {
  console.log(`Uploading to IPFS ...`)

  let api
  let gateway
  let cids

  if (argv.network === 'localhost') {
    api = getMeta().options.find(({ name }) => name === 'api').defaultValue
    gateway = getMeta().options.find(({ name }) => name === 'gateway').defaultValue
  } else if (argv.network === 'rinkeby') {
    api = `pinata://${PINATA_API_KEY}:${PINATA_SECRET}`,
    gateway = 'https://ipfs.gft.xyz/ipfs/'
  } else {
    throw new Error('Unsupported network')
  }

  cids = await execute({
    folder: ipfsDataDir,
    api,
    gateway,
  })

  if (gateway.substr(-1) !== '/') {
    gateway = `${gateway}/`
  }

  const releaseInfo = {
    network: argv.network,
    saveDeployedAddresses: (argv.network !== 'localhost'),
    isLocalDevnet: (argv.network === 'localhost'),
    deployDummyTokens: (['localhost', 'rinkeby'].includes(argv.network)),
    contractDefaults: {
      baseURI: gateway,
      ...cids,
    }
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