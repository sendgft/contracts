import { strict as assert } from 'assert'

import { createLog, deployContract, getContractAt } from '../utils'

export const deployGifter = async ({ artifacts, isLocalNetwork, log }) => {
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

  await log.task('Verify proxy <-> logic', async () => {
    const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)
    assert.equal(await gifter.getVersion(), '1')
  })

  return { 
    proxy, 
    proxyConstructorArgs,
    impl,
    implConstructorsArgs,
  }
}