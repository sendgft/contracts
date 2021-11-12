[![CircleCI](https://circleci.com/gh/sendgft/contracts/tree/master.svg?style=svg)](https://circleci.com/gh/sendgft/contracts/tree/master) [![Coverage Status](https://coveralls.io/repos/github/sendgft/contracts/badge.svg?branch=master)](https://coveralls.io/github/sendgft/contracts?branch=master)

[gft.xyz](https://gft.xyz) Smart contracts.

## How to use

Install the package:

```
npm install @sendgft/contracts
```

The package exposes the following properties:

* `contracts` - the key contracts (see below)
* `addresses` - contents of `deployedAddresses.json`
* `events` - ABIs for events to listen for


## Development

**Requirements:**

* Node.js 14.16.0+
* Yarn 1.22.10+ (use `npm i -g yarn` once Node.js is installed)

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

## License

MIT (see `LICENSE.md`)