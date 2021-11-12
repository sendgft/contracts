require('dotenv').config()
require('@babel/register')
require("core-js/stable")
require("regenerator-runtime/runtime")
require("@nomiclabs/hardhat-ethers")
require("@nomiclabs/hardhat-truffle5")
require("@nomiclabs/hardhat-etherscan")
require('solidity-coverage')

const { TEST_MNEMONIC } = require('./utils/constants')

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  defaultNetwork: 'hardhat',

  networks: {
    hardhat: {
      chainId: 31337,
      initialBaseFeePerGas: 0,
      blockGasLimit: 30000000,
      accounts: {
        mnemonic: TEST_MNEMONIC,
        count: 50,
      },
      mining: {
        auto: true,
      },
    },
    avax: {
      chainId: 43114,
      url: `https://api.avax.network/ext/bc/C/rpc`,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
      timeout: 120000,
    },
    rinkeby: {
      chainId: 4,
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
      timeout: 120000,
    }
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },

  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },
}

