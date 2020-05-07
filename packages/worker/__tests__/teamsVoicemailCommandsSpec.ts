import { App } from 'iopa'
import {
    makeFetch,
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
import { interceptMsGraphResponses } from '@sync247/capability-msgraph/testing-framework'
import { interceptCarrierResponses } from 'iopa-carrier/testing-framework'
import { EdgeApp } from '@iopa-edge/types'
import * as ReactiveCards from 'reactive-cards'
import mainMiddlewareApp from '../src/index'
import { SeedData } from '../testing-framework'

const secrets = require('../.config/.env-test.json').test

const { version } = require('../package.json')

declare const global
global.React = ReactiveCards

let setupProxy: { listen: () => void; close: () => void }
let teamsCmd: (text: string) => Super
let app: EdgeApp
let superFetch: FetchFunction

beforeAll(() => {
    process.env.NODE_ENV = 'test'
    Object.keys(secrets).forEach((key) => {
        process.env[key] = secrets[key]
    })

    app = (new App({
        'server.Version': version,
    }) as unknown) as EdgeApp
    app.use(SeedData)
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

describe('Teams BotCommand Spec', () => {
    test('Voicemail message should result in response', async (done) => {
        expect(app.invoke).toBeDefined()

        app.properties
            .get('server.Testing')
            .set('msgraph.isAdministrator', true)

        const result = await teamsCmd(
            'voicemail 16158026790 Thank you for calling SyncTalk.  If this is an emergency please dial 911. Press 1 to receive a callback from an associate or any other key to leave a voice message'
        )
            .expect(200, '')
            .end()

        expect(result.related.length).toBe(1)
        expect(
            result.related[0].body.attachments[0].content.body[0].text
        ).toContain('Voicemail updated')
        expect(
            (
                await app.db
                    .collection('virtualnumbers')
                    .doc('+16158026790')
                    .get()
            ).data()
        ).toMatchObject({
            voicemailText: expect.stringContaining('Thank you for'),
        })

        done()
    })
})
