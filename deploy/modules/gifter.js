import _ from 'lodash'
import delay from 'delay'
import { strict as assert } from 'assert'
import got from 'got'

import { createLog, deployContract, getContractAt } from '../utils'

export const deployGifter = async ({ artifacts, log, deployConfig, deployedAddressesToSave }) => {
  if (!log) {
    log = createLog()
  }

  let impl
  const implConstructorsArgs = []
  await log.task('Deploy implementation contract', async task => {
    impl = await deployContract({ artifacts }, 'GifterImplementationV1', implConstructorsArgs)
    await task.log(`Deployed at ${impl.address}`)
  })

  let proxy
  let proxyConstructorArgs

  await log.task('Deploy proxy contract', async task => {
    proxyConstructorArgs = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]
    proxy = await deployContract({ artifacts }, 'Gifter', proxyConstructorArgs)
    await task.log(`Deployed at ${proxy.address}`)
  })

  await delay(5000)

  const { defaultContentHash, baseURI } = _.get(deployConfig, 'contractDefaults', {})
  
  if (defaultContentHash && baseURI) {
    await log.task('Check default content hash and base URI', async t => {
      // check default metadata
      const url = `${baseURI}/${defaultContentHash}`
      await t.log(`Checking URL exists: ${url}`)
      const { body } = await got(url)
      await t.log(body)
      assert(JSON.parse(body).name.length > 0)
    })

    await log.task(`Set: default content hash: ${defaultContentHash}`, async () => {
      const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)
      await gifter.setDefaultContentHash(defaultContentHash)
    })

    await log.task(`Set: default base URI: ${baseURI}`, async () => {
      const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)
      await gifter.setBaseURI(baseURI)
    })
  }

  // tell context what addresses to save
  if (deployedAddressesToSave) {
    deployedAddressesToSave.Gifter = proxy.address
  }

  return { 
    proxy, 
    proxyConstructorArgs,
    impl,
    implConstructorsArgs,
  }
}