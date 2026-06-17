module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/*.test.js',
  ],
  testMatch: ['**/tests/**/*.test.js'],
};
