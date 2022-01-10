import _ from 'lodash'
import delay from 'delay'
import { strict as assert } from 'assert'
import got from 'got'

import { createLog, deployContract, getContractAt, execMethod, assertSameAddress } from '../utils'
import { LOCAL_DEVNET_ADDRESSES } from '../../utils/constants'

export const deployGifter = async (ctx = {}) => {
  const { artifacts, log = createLog(), deployConfig, deployedAddressesToSave, isLocalDevnet } = ctx

  let impl
  const implConstructorsArgs = []
  await log.task('Deploy implementation contract', async task => {
    impl = await deployContract(ctx, 'GifterImplementationV1', implConstructorsArgs)
    await task.log(`Deployed at ${impl.address}`)

    if (isLocalDevnet) {
      assertSameAddress(impl.address, LOCAL_DEVNET_ADDRESSES.gifterImpl, 'gifterImpl')
    }
  })

  let proxy
  let proxyConstructorArgs

  await log.task('Deploy proxy contract', async task => {
    proxyConstructorArgs = [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ]
    proxy = await deployContract(ctx, 'Gifter', proxyConstructorArgs)
    await task.log(`Deployed at ${proxy.address}`)

    if (isLocalDevnet) {
      assertSameAddress(proxy.address, LOCAL_DEVNET_ADDRESSES.gifterProxy, 'gifterProxy')
    }
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

    const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)

    await log.task(`Set: default content hash: ${defaultContentHash}`, async task => {
      await execMethod({ ctx, task }, gifter, 'setDefaultContentHash', [defaultContentHash])
    })

    await log.task(`Set: default base URI: ${baseURI}`, async task => {
      await execMethod({ ctx, task }, gifter, 'setBaseURI', [baseURI])
    })
  }

  if (deployedAddressesToSave) {
    deployedAddressesToSave.Factory = proxy.address
  }

  return { 
    proxy, 
    proxyConstructorArgs,
    impl,
    implConstructorsArgs,
  }
}