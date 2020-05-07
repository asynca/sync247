import { App } from 'iopa'
import {
    makeFetch,
    Response,
    Super,
    interceptAllResponses,
    MemoryStore,
} from '@iopa-edge/testing-framework'
import type { FetchFunction } from '@iopa-edge/testing-framework'
import { setupServer } from 'msw/node'
import {
    makeTeamsInboundTextFetch,
    interceptTeamsResponses,
} from 'iopa-botadapter/testing-framework'
import { IopaApp } from 'iopa-types'
import { interceptMsGraphResponses } from '@sync247/capability-msgraph/testing-framework'
import { interceptCarrierResponses } from 'iopa-carrier/testing-framework'
import * as ReactiveCards from 'reactive-cards'
import mainMiddlewareApp from '../src/index'

declare const global
global.React = ReactiveCards
const secrets = require('../.config/.env-test.json').test

const { version } = require('../package.json')

let setupProxy: { listen: () => void; close: () => void }
let teamsCmd: (text: string) => Super
let app: IopaApp
let superFetch: FetchFunction

global.btoa = require('btoa')

beforeAll(() => {
    process.env.NODE_ENV = 'test'
    Object.keys(secrets).forEach((key) => {
        process.env[key] = secrets[key]
    })

    app = new App({
        'server.Version': version,
    })
    app.use(MemoryStore)
    app.use(mainMiddlewareApp, 'entry-test')
    app.build()

    superFetch = makeFetch(app)
    teamsCmd = makeTeamsInboundTextFetch(app, {})
    setupProxy = setupServer(
        ...interceptTeamsResponses(app),
        ...interceptMsGraphResponses(app),
        ...interceptCarrierResponses(app),
        ...interceptAllResponses(app)
    )
    setupProxy.listen()
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

describe('Teams BotCommand Spec', () => {
    test('Help message should result in response', async (done) => {
        expect(app.invoke).toBeDefined()

        const result = await teamsCmd('help').expect(200, '').end()

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

    test('provision when not administrator', async (done) => {
        expect(app.invoke).toBeDefined()

        app.properties
            .get('server.Testing')
            .set('msgraph.isAdministrator', false)

        const result = await teamsCmd('provision self 615')
            .expect(200, '')
            .end()

        // verify that mock handler above results in resulting teams responses that are matched to outbound context
        expect(result.related.length).toBe(1)

        expect(result.related[0].type).toBe(
            'com.microsoft.msteams.conversation.activity'
        )
        expect(result.related[0].body).toMatchObject({
            type: 'message',
            attachmentLayout: 'list',
            attachments: [
                {
                    contentType: 'application/vnd.microsoft.card.hero',
                    content: {
                        title: 'Provision Error',
                        text:
                            'Sorry, you have to be an administrator to be able to provision resources',
                    },
                },
            ],
            inputHint: 'acceptingInput',
            channelId: 'msteams',
            serviceUrl: 'https://smba.trafficmanager.net/amer/',
        })

        done()
    })

    test('provision when administrator and SMS disabled number', async (done) => {
        expect(app.invoke).toBeDefined()

        app.properties
            .get('server.Testing')
            .set('msgraph.isAdministrator', true)

        app.properties.get('server.Testing').set('carrier.isSMSEnabled', false)

        const result = await teamsCmd('provision self 615')
            .expect(200, '')
            .end()

        expect(result.related.length).toBe(2)
        expect(result.related[0].body).toMatchObject({
            text: expect.stringContaining('Provisioning'),
        })
        expect(result.related[1].body).toMatchObject({
            text: expect.stringContaining(
                'That number is not both voice and SMS enabled'
            ),
        })

        done()
    })

    test('provision when administrator and SMS enabled number', async (done) => {
        jest.setTimeout(60000)

        expect(app.invoke).toBeDefined()

        app.properties
            .get('server.Testing')
            .set('msgraph.isAdministrator', true)

        app.properties.get('server.Testing').set('carrier.isSMSEnabled', true)

        const result = await teamsCmd('provision self 615')
            .expect(200, '')
            .end()

        expect(result.related.length).toBe(4)
        expect(result.related[0].body).toMatchObject({
            text: expect.stringContaining('Provisioning'),
        })
        expect(result.related[1].body).toMatchObject({
            text: expect.stringContaining('Found virtual number'),
        })
        expect(result.related[2].body).toMatchObject({
            text: expect.stringContaining('Updated virtual number to '),
        })
        expect(result.related[3].body.attachments[0].content).toMatchObject({
            text: expect.stringContaining('Creating a new team site'),
        })

        done()
    })
})
