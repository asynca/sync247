const webpack = require('webpack')

const secretKeys = process.env.ENVKEYS.split(',').reduce((accum, key) => {
    accum[key] = false
    return accum
}, {})

const plugins = [
    new webpack.EnvironmentPlugin({
        ...secretKeys,
        NODE_ENV: process.env.NODE_ENV || 'production', // use NODE_ENV from env-cmd or 'production' if not specified
        REDIRECT_HOST: false, // use default from env-cmd
        DEV_REMOTE: false
    })
]

const rules = [
    {
        test: /(\.tsx?|\.jsx)$/,
        use: {
            loader: '@sucrase/webpack-loader',
            options: {
                transforms: ['typescript', 'jsx'],
                jsxPragma: "ReactiveCards.h",
                production: true,
            },
        },
    },
]

module.exports = {
    target: 'webworker',
    entry: './src/entry-cloudflare.ts',
    resolve: {
        extensions: [
            '.wasm',
            '.mjs',
            '.js',
            '.json',
            '.ts',
            '.tsx',
            '.graphql',
            '.d.ts'
        ],
        mainFields: ['browser', 'module', 'ts:main', 'main'],
    },
    plugins,
    module: { rules },
    mode: 'production',
    optimization: {
        minimize: false
    },
}