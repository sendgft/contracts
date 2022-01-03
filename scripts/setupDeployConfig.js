#!/usr/bin/env node

/* This script generates the deployment config */

const fs = require('fs')
const got = require('got')
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

const projectDir = path.join(__dirname, '..')
const releaseConfigFile = path.join(projectDir, 'releaseConfig.json')

// const GNOSIS_SAFES = {
//   mainnet: '',
// }

async function main() {
  // check params
  ;['cid', 'gateway'].forEach(p => {
    if (!argv[p]) {
      throw new Error(`Missing param: ${p}`)
    }
  })

  const releaseInfo = {
    saveDeployedAddresses: (argv.network !== 'localhost'),
    contractDefaults: {
      defaultContentHash: argv.cid,
      baseURI: argv.gateway,
    }
  }

  fs.writeFileSync(releaseConfigFile, JSON.stringify(releaseInfo, null, 2), 'utf8')

  console.log(`Release config created:

${JSON.stringify(releaseInfo, null, 2)}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })