import { IopaBotReading, IopaContext } from 'iopa-types'
import { EdgeApp } from '@iopa-edge/types'
import { constants as IOPA, App as IopaApp } from 'iopa'
import Router from 'iopa-router'
import { makeFetch, FetchFunction } from '@iopa-edge/testing-framework'

import { IopaBotAdapterContext } from 'iopa-botadapter'
import CapabilityMicrosoftTeams from '../src/index'

const { version } = require('../package.json')

function testMiddleware(app: EdgeApp) {
    // Default Iopa App (catch-all)
    app[IOPA.APPBUILDER.DefaultApp] = async (context: IopaContext, _) => {
        context.response['iopa.StatusCode'] = 404
        context.response.end('SUPER-404 Resource was not found')
    }

    // Core capabilities
    app.use(Router, 'Router')

    // Main App
    app.use(CapabilityMicrosoftTeams, 'TeamsCapability')

    teamsApp = app.fork(
        (context: IopaBotReading) =>
            context.get('bot.Provider') === 'msteams' ||
            context.get('bot.Provider') === 'emulator'
    )
}

let app: EdgeApp
let teamsApp: EdgeApp
let superFetch: FetchFunction

beforeEach(() => {
    process.env.MSAPP_ID = 'MSAPP_ID_TEST'
    process.env.MSAPP_SECRET = 'MSAPP_SECRET'
    process.env.NODE_ENV = 'test'

    app = (new IopaApp({
        'server.Version': version,
    }) as unknown) as EdgeApp
    app.use(testMiddleware, 'entry-test')

    superFetch = makeFetch(app)
})

describe('Teams spec', () => {
    test('teams message should work', async (done) => {
        let lastContext: IopaBotAdapterContext

        teamsApp.use(function teamsAppTest(context, next) {
            lastContext = context
            return next()
        }, 'teamsAppTest')
        app.build()

        expect(app.invoke).toBeDefined()

        await superFetch('/client/v1.0.0/msbot/api/messages', {
            method: 'post',
            headers: {
                'accept-encoding': 'gzip',
                authorization: '',
                'cdn-loop': 'cloudflare; subreqs=1',
                'cf-connecting-ip': '::1',
                'cf-ew-via': '15',
                'cf-ray': '5d14387390c6cec0-IAD',
                'cf-request-id': '0520819c3f0000cec0211b0000000001',
                'cf-visitor': '{"scheme":"https"}',
                'cf-worker': 'sync247.net',
                'content-length': '1459',
                'content-type': 'application/json; charset=utf-8',
                forwarded: 'by=IOPA',
                host: '1e31c6e81102.ngrok.io',
                'ms-cv': 'eY2Fy8Mp3UuMo2yHLzVjhw.1.5.1.2471559270.1.2',
                'user-agent':
                    'Microsoft-SkypeBotApi (Microsoft-BotFramework/3.0)',
                'x-forwarded-for': '52.114.142.186, 172.68.65.69',
                'x-forwarded-proto': 'https, https',
            },
            body: JSON.stringify({
                text: '<at>sync (d)</at> help\n',
                textFormat: 'plain',
                attachments: [
                    {
                        contentType: 'text/html',
                        content:
                            '<div><div><span itemscope="" itemtype="http://schema.skype.com/Mention" itemid="0">sync (d)</span>&nbsp;help</div>\n</div>',
                    },
                ],
                type: 'message',
                timestamp: '2020-09-11T20:51:26.5323727Z',
                localTimestamp: '2020-09-11T15:51:26.5323727-05:00',
                id: '1599857486507',
                channelId: 'msteams',
                serviceUrl: 'https://smba.trafficmanager.net/amer/',
                from: {
                    id:
                        '29:1EQUTJXDNE-g2_JSvyX2eKtyU1yWM8hGYn7pMjvw4_gHhs93OyhH0VJIBPR0rzKkz4Q9dYnIK7w6shTFrgsRevw',
                    name: 'Guy Barnard',
                    aadObjectId: '75193827-3e97-4b5a-8aa8-f506ffb07af0',
                },
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    tenantId: 'fbe59500-b0cc-491b-aa3e-ffaf2699aec9',
                    id:
                        '19:9051aea57b4a4a12a64ac7fc3b474a27@thread.skype;messageid=1599857486507',
                },
                recipient: {
                    id: '28:94a9d0b9-0fa9-4f14-b2e3-f31464fb763a',
                    name: 'sync  d ',
                },
                entities: [
                    {
                        mentioned: {
                            id: '28:94a9d0b9-0fa9-4f14-b2e3-f31464fb763a',
                            name: 'sync (d)',
                        },
                        text: '<at>sync (d)</at>',
                        type: 'mention',
                    },
                    {
                        locale: 'en-US',
                        country: 'US',
                        platform: 'Mac',
                        type: 'clientInfo',
                    },
                ],
                channelData: {
                    teamsChannelId:
                        '19:9051aea57b4a4a12a64ac7fc3b474a27@thread.skype',
                    teamsTeamId:
                        '19:f87713d7ec4c4ccb90d1695ea45c677e@thread.skype',
                    channel: {
                        id: '19:9051aea57b4a4a12a64ac7fc3b474a27@thread.skype',
                    },
                    team: {
                        id: '19:f87713d7ec4c4ccb90d1695ea45c677e@thread.skype',
                    },
                    tenant: {
                        id: 'fbe59500-b0cc-491b-aa3e-ffaf2699aec9',
                    },
                },
                locale: 'en-US',
            }),
        })
            .expect(200, '')
            .end()

        expect(lastContext['bot.Capability']).toMatchObject({
            activity: {
                text: 'help',
                textFormat: 'plain',
                type: 'message',
                id: '1599857486507',
                channelId: 'msteams',
                serviceUrl: 'https://smba.trafficmanager.net/amer/',
                locale: 'en-US',
            },
            responded: false,
        })

        done()
    })
})
