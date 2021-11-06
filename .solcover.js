const spawn = require('cross-spawn')

module.exports = {
  istanbulFolder: './coverage',
  istanbulReporter: ['lcov', 'html'],
  skipFiles: [
  ],
  onCompileComplete: async () => {
    await spawn('yarn', ['generate-index'], { cwd: __dirname })
  }
}
