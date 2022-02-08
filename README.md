[gft.xyz](https://gft.xyz) Smart contracts.

## How to use

Install the package:

```
npm install @sendgft/contracts
```

The package exposes the following properties:

* `contracts` - the key contracts JSON artifact contents 
* `addresses` - contents of `deployedAddresses.json`
* `events` - ABIs for events to listen for

**Example**

```js
const ethers = require('ethers')
const { contracts, addresses } = require('@sendgft/contracts')

const contract = new ethers.Contract(
  addresses.Gifter.chains[4].address, // rinkeby
  contracts.GifterV1.abi
)
```

## Development

**Requirements:**

* Node.js 14.18.0+
* Yarn 1.22.10+ (use `npm i -g yarn` once Node.js is installed)

Copy `.env.sample` to `.env` and fill in the values (available in our password vault).

Install dependencies:

```shell
yarn
```

Initialize git submodules (for maker-otc trading engine):

```shell
git submodule init
git submodule update
```

First, run the dev network in a separate terminal:

```shell
yarn devnet
```

Compile the contracts:

```shell
yarn compile
```

Setup the deployment config (only need to run this once):

```shell
yarn setup-deploy-config:local
```

Now deploy the contracts to it:

```shell
yarn deploy:local
```

Now you can run the tests:

```shell
yarn test
```

To run a single test:

```shell
yarn test ./test/testName.js --network test
```

### Deployments

Set up the env vars:

```shell
export MNEMONIC="..."
export INFURA_KEY="..."
```

To deploy Rinkeby contracts:

```shell
yarn setup-deploy-config:rinkeby
yarn deploy:rinkeby
```

For Avalanche:

```shell
yarn deploy:avax
```

**Publishing**

Ensure you deploy the contracts first (see above) so that `deployedAddresses.json` is updated.

Commit the code and push the changes.

Then run:

```shell
yarn release
```

## License

MIT (see `LICENSE.md`)
