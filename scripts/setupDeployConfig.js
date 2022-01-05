#!/usr/bin/env node

/* This script generates the deployment config */

const fs = require('fs')
const got = require('got')
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const projectDir = path.join(__dirname, '..')
const deployConfigFile = path.join(projectDir, 'deployConfig.json')

async function main() {
  argv.cid = argv.cid || 'QmfQqrNx75k8AjXeq2oqsqRVowGJQCgi6Cw4qHrfquyN6j'
  argv.gateway = argv.gateway || 'https://ipfs.gft.xyz/ipfs/'

  if (argv.gateway && argv.gateway.substr(-1) !== '/') {
    argv.gateway = `${argv.gateway}/`
  }

  const releaseInfo = {
    saveDeployedAddresses: (argv.network !== 'localhost'),
    contractDefaults: {
      defaultContentHash: argv.cid,
      baseURI: argv.gateway,
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