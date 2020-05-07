import { App as IopaApp } from 'iopa'
import { makeFetch, Response, Super } from '@iopa-edge/testing-framework'
import type { FetchFunction } from '@iopa-edge/testing-framework'
import { setupServer } from 'msw/node'
import {
    makeTeamsInboundTextFetch,
    interceptTeamsResponses,
} from 'iopa-botadapter/testing-framework'
import { interceptMsGraphResponses } from '@sync247/capability-msgraph/testing-framework'
import mainMiddlewareApp from '../src/index'

const { version } = require('../package.json')

let setupProxy: { listen: () => void; close: () => void }
let teamsFetch: (text: string) => Super
let app: IopaApp
let superFetch: FetchFunction

beforeAll(() => {
    process.env.MSAPP_ID = 'MSAPP_ID_TEST'
    process.env.MSAPP_SECRET = 'MSAPP_SECRET'
    process.env.MSAPP_TENANT = 'fbe59500-b0cc-491b-aa3e-ffaf2699aec9'
    process.env.NODE_ENV = 'test'

    app = new IopaApp({
        'server.Version': version,
    })
    app.use(mainMiddlewareApp, 'entry-test')
    app.build()

    superFetch = makeFetch(app)

    setupProxy = setupServer(
        ...interceptTeamsResponses(app),
        ...interceptMsGraphResponses(app)
    )
    setupProxy.listen()
    teamsFetch = makeTeamsInboundTextFetch(app, {})
})

afterAll(() => {
    setupProxy.close()
})

describe('Worker spec', () => {
    it('should create the app invoke function', () => {
        expect(app.invoke).toBeDefined()
    })

    test('fetch from makeFetch should work', async (done) => {
        expect(app.invoke).toBeDefined()

        const result: Response = await superFetch('/client/v1.0.0/version', {
            method: 'get',
        })
            .expect(200)
            .end()

        expect(await result.text()).toBe(
            'CloudFlare test localhost package @sync247/worker version 1.0.0'
        )

        done()
    })
})

describe('Teams spec', () => {
    test('teams inbound message should result in response', async (done) => {
        expect(app.invoke).toBeDefined()

        const result = await teamsFetch('help').expect(200, '').end()

        // verify that mock handler above results in resulting teams responses that are matched to outbound context
        expect(result.related.length).toBe(1)
        expect(result.related[0].type).toBe(
            'com.microsoft.msteams.conversation.activity'
        )
        expect(result.related[0].body).toMatchObject({
            type: 'message',
            text: expect.stringContaining('Usage:  [--Options] [command]'),
            inputHint: 'acceptingInput',
            channelId: 'msteams',
            serviceUrl: 'https://smba.trafficmanager.net/amer/',
            recipient: {
                name: 'Guy Barnard',
            },
        })

        done()
    })
})
