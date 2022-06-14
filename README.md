[gft.xyz](https://gft.xyz) Smart contracts.

These contracts use the [Diamond Standard](https://github.com/mudgen/diamond-1-hardhat) to allow for infinite 
size and upgradeability. 

**Note:** `IMaster.sol` specifies a convenience interface combines all the different diamond facet interfaces into one - we recommend using this.

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
  addresses.Gifter.chains[5].address, // goerli
  contracts.IMaster.abi
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
yarn test ./test/testName.js
```

**Testing DEX integrations**

To test the `AvaxDex.sol` integration with [TraderJoe](https://traderjoe.xyz):

```
yarn compile
export MNEMONIC="..." 
./scripts/testAvaxDex.js
```

_NOTE: `MNEMONIC` should be set to your account's mnemonic. Ensure it has enough AVAX to deploy and interact with the DEX contract_.

### Deployments

We use the same wallet on every network to deploy from. Deployment always happens at the same wallet nonce so that our contract addresses are the same on every network.

The deployment script will check to ensure that the wallet nonce is at the expected 
number prior to deploying. Once the contracts are deployed on a given network, subsequent deployments will simply result in an upgrade call.

Set up the env vars:

```shell
export MNEMONIC="..."
export INFURA_ID="..."
export PINATA_API_KEY="..."
export PINATA_SECRET="..."
```

**Goerli testnet**

```shell
yarn setup-deploy-config:goerli
yarn deploy:goerli
```

**Avalanche mainnet**

```shell
yarn setup-deploy-config:avax
yarn deploy:avax
```

**Publishing**

Ensure you deploy the contracts first (see above) so that `deployedAddresses.json` is updated.

Commit the code and push the changes.

Then run:

```shell
yarn release
```

**Git Subtree**

Note that the `cards/**` folder contents are populated using `git subtree` and the following repos:
  * `cards/cells-cat-card` = https://github.com/sendgft/cells-cat-card

## License

MIT (see `LICENSE.md`)
