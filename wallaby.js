module.exports = (wallaby) => {
    process.env.NODE_ENV = 'test'
    return {
        env: {
            type: 'node',
            runner: 'node',
        },
        testFramework: 'jest',
        files: [
            '.config/jest.config.js',
            '.config/jestresolver.js',
            'tsconfig.json',
            '{,!(node_modules)/}packages/*/src/**',
            '{,!(node_modules)/}packages/*/__tests__/**/*.{ts,tsx}',
            '{,!(node_modules)/}packages/*/*.json',
            '!**/*.d.ts',
            '!**/*.{snap}',
            { pattern: 'packages/*/__tests__/**/*Spec.{ts,tsx}', ignore: true },
        ],
        compilers: {},
        tests: [
            {
                pattern: 'packages/*/__tests__/**/*Spec.{ts,tsx}',
                ignore: false,
            },
            //    '*/packages/*/__tests__/**/*Spec.{ts,tsx}',
        ],
        // eslint-disable-next-line no-shadow
        setup: (wallaby) => {
            let jestConfig = global._modifiedJestConfig
            if (!jestConfig) {
                const baseJestConfig = require('./.config/jest.config.js')
                delete baseJestConfig.projects
                // eslint-disable-next-line no-multi-assign
                jestConfig = global._modifiedJestConfig = baseJestConfig
            }
            wallaby.testFramework.configure(jestConfig)
        },
    }
}

//    tests: ['{,!(node_modules)/}/packages/*/__tests__/**/*Spec.{ts,tsx}'],
