var glob = require('glob');

const PROJECTS = glob.sync('{,!(node_modules)/}packages/*/__tests__').map(x => { 
    const arr = x.split('/')
    arr.pop()
    return arr.join('/')
})

const commonConfig = {
    resolver: require.resolve('./jestResolver.js'),
    moduleFileExtensions: ['js', 'jsx', 'tsx', 'ts', 'json'],
    transform: {
        '.(js|jsx|ts|tsx)': require.resolve('./jestSucraseTransform.js'),
    },
    transformIgnorePatterns: [
        ".*(node_modules)(?!.*iopa-.*).*$"
      ]
}

const globalConfig = {
    ...commonConfig,
    coverageDirectory: '../coverage',
    collectCoverage: false,
    silent: true,
    testEnvironment: 'node',
    rootDir: '..',
  //  roots: PROJECTS
}

const projectConfig = (dir) => ({
    ...commonConfig,
    displayName: dir.split('/',2)[1],
    rootDir: dir,
    roots: ['__tests__'],
    testMatch: [
        '<rootDir>/__tests__/**/*Spec.{ts,tsx}',
    ],
    collectCoverageFrom: [
        '<rootDir>/src/**/*.{ts,tsx}',
    ]
})


module.exports = {
    ...globalConfig,
    projects: PROJECTS.map((dir) => projectConfig(dir))
}

