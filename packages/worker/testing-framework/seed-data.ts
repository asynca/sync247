import { EdgeApp } from '@iopa-edge/types'

export class SeedData {
  constructor(app: EdgeApp) {
    app.properties['server.Testing'].set('db', {
      'specialists/75193827-3e97-4b5a-8aa8-f506ffb07af0': {
        provisionedNumbers: ['+16158026790'],
        updated: 1600208273422,
        virtualNumber: '+16158026790'
      },
      'teams/19:0092ef997af44c13b1a971104aba1919@thread.tacv2': {
        teamGlobalId: '936eb586-a946-4e58-a6b9-19baa1011328',
        teamName: 'sync 1 (615) 802-6790 Barnard',
        userLocalId: '28:94a9d0b9-0fa9-4f14-b2e3-f31464fb763a',
        userGlobalId: '75193827-3e97-4b5a-8aa8-f506ffb07af0',
        carrierProvider: 'twilio',
        virtualNumber: '+16158026790',
        physicalNumber: '+16159456528',
        'bot.Source': 'urn:io.iopa:botadapater',
        'bot.Provider': 'msteams',
        'bot.ServiceUrl': 'https://smba.trafficmanager.net/amer/',
        role: 'provisioned',
        userName: 'Guy Barnard',
        userGivenName: 'Guy',
        userSurname: 'Barnard',
        updated: 1600208273421
      },
      'virtualnumbers/+16158026790': {
        teamId: '19:0092ef997af44c13b1a971104aba1919@thread.tacv2',
        teamGlobalId: '936eb586-a946-4e58-a6b9-19baa1011328',
        teamName: 'sync 1 (615) 802-6790 Barnard',
        userLocalId: '28:94a9d0b9-0fa9-4f14-b2e3-f31464fb763a',
        userGlobalId: '75193827-3e97-4b5a-8aa8-f506ffb07af0',
        carrierProvider: 'twilio',
        physicalNumber: '+16159456528',
        'bot.Source': 'urn:io.iopa:botadapater',
        'bot.Provider': 'msteams',
        'bot.ServiceUrl': 'https://smba.trafficmanager.net/amer/',
        role: 'provisioned',
        userName: 'Guy Barnard',
        userGivenName: 'Guy',
        userSurname: 'Barnard',
        updated: 1600208273421
      }
    })
  }
}

export default SeedData
