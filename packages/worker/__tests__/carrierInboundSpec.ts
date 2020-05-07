import { App } from 'iopa'
import {
    Super,
    interceptAllResponses,
    MemoryStore,
} from '@iopa-edge/testing-framework'
import { setupServer } from 'msw/node'
import { interceptTeamsResponses } from 'iopa-botadapter/testing-framework'
import {
    makeCarrierInboundSms,
    makeCarrierInboundVoice,
    interceptCarrierResponses,
} from 'iopa-carrier/testing-framework'
import { interceptMsGraphResponses } from '@sync247/capability-msgraph/testing-framework'

import { EdgeApp } from '@iopa-edge/types'
import * as ReactiveCards from 'reactive-cards'
import mainMiddlewareApp from '../src/index'
import { SeedData } from '../testing-framework'

const secrets = require('../.config/.env-test.json').test

const { version } = require('../package.json')

let setupProxy: { listen: () => void; close: () => void }
let smsInbound: (text: string, from?: string, to?: string) => Super
let voiceInbound: (
    status: 'ringing' | 'whisper-busy' | 'complete',
    from?: string,
    to?: string
) => Super
let app: EdgeApp

declare const global
global.React = ReactiveCards

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

    smsInbound = makeCarrierInboundSms(app, {})
    voiceInbound = makeCarrierInboundVoice(app, {})
    setupProxy = setupServer(
        ...interceptTeamsResponses(app),
        ...interceptCarrierResponses(app),
        ...interceptMsGraphResponses(app),
        ...interceptAllResponses(app)
    )
    setupProxy.listen()
})

afterAll(() => {
    setupProxy.close()
})

describe('Teams BotCommand Spec', () => {
    /* test('SMS message should result in messaged relayed to new or existing teams channel', async (done) => {
        expect(app.invoke).toBeDefined()

        const result = await smsInbound('hello')
            .expect(
                200,
                '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
            )
            .end()

        expect(result.related.length).toBe(1)
        expect(result.related[0].type).toBe(
            'com.microsoft.msteams.conversation.activity'
        )
        expect(
            result.related[0].body.activity.attachments[0].content.body[1]
        ).toMatchObject({
            text: expect.stringContaining('hello'),
        })
        done()
    }) */

    test('Voice call should result in forward', async (done: any) => {
        expect(app.invoke).toBeDefined()

        await voiceInbound('ringing')
            .expect(
                200,
                `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Dial answerOnBridge="true" action="http://localhost/client/v1.0.0/carrier/api?provider=twilio&amp;type=voice&amp;callback_token=TWILIO_CALLBACK_TOKEN&amp;subtype=callcomplete" timeout="12">
        <Number url="http://localhost/client/v1.0.0/carrier/api?provider=twilio&amp;type=voice&amp;callback_token=TWILIO_CALLBACK_TOKEN&amp;subtype=whisper">+16159456528</Number>
        </Dial>
    </Response>`
            )
            .end()

        const result2 = await voiceInbound('whisper-busy').expect(200).end()
        expect(result2.toJSON().body).toContain('Thank you for calling')

        done()
    })
})
