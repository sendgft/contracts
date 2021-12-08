import { strict as assert } from 'assert'

import { createLog, deployContract, getContractAt } from '../utils'

export const deployGifter = async ({ artifacts }, log) => {
  if (!log) {
    log = createLog()
  }

  let impl
  await log.task('Deploy implementation contract', async task => {
    impl = await deployContract({ artifacts }, 'GifterImplementationV1')
    await task.log(`Deployed at ${impl.address}`)
  })

  let proxy
  await log.task('Deploy proxy contract', async task => {
    proxy = await deployContract({ artifacts }, 'Gifter', [
      impl.address, impl.contract.methods.initialize().encodeABI()
    ])
    await task.log(`Deployed at ${proxy.address}`)
  })

  await log.task('Verify proxy <-> logic', async () => {
    const gifter = await getContractAt({ artifacts }, 'IGifter', proxy.address)
    assert.equal(await gifter.getVersion(), '1')
  })

  return { proxy, impl }
}