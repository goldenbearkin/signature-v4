module.exports = wallaby => ({
  files: [
    'lib/**/*.ts',
    'test/aws4_testsuite/**/*'
    // { pattern: 'node_modules/chai/chai.js', instrument: false },
    // { pattern: 'node_modules/sinon/pkg/sinon.js', instrument: false },
    // { pattern: 'src/**/*.js', instrument: true, load: true, ignore: false }
  ],

  tests: ['test/**/*spec.ts'],

  compilers: {
    '**/*.ts': wallaby.compilers.typeScript({
      module: 'commonjs'
    })
  },

  setup: function () {
    // global.expect = require('chai').expect;
    // global.fixtures = wallaby.localProjectDir;
  },

  testFramework: {
    type: 'mocha',
    path: 'mocha'
  },

  env: {
    type: 'node'
  },
});