import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-etherscan"
import 'solidity-coverage'
import { HardhatUserConfig } from "hardhat/config"

const { ETHERSCAN_API_KEY, SNOWTRACE_API_KEY, MNEMONIC, INFURA_ID } = require('dotenv').config().parsed
const { TEST_MNEMONIC } = require('./src/constants')

const config: HardhatUserConfig = {
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
      chainId: 1337,
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
    goerli: {
      chainId: 5,
      url: `https://goerli.infura.io/v3/${INFURA_ID}`,
      accounts: {
        mnemonic: MNEMONIC,
      },
      timeout: 120000,
    },
    avalanche: {
      chainId: 43114,
      url: `https://api.avax.network/ext/bc/C/rpc`,
      accounts: {
        mnemonic: MNEMONIC,
      },
      timeout: 120000,
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-rpc.com/`,
      accounts: {
        mnemonic: MNEMONIC,
      },
      timeout: 120000,
    },
  },

  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY,
      avalanche: SNOWTRACE_API_KEY,
    }
  },

  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },
}

export default config