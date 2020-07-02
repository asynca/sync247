import { BotAdapterApp, BotAdapterMiddleware } from 'iopa-botadapter'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Carrier } from 'iopa-carrier'
import Sync247Store from '@sync247/capability-sync247-store'
import { BotCommand } from 'iopa-botcommander'
import { TeamsStoreMsTeams, TeamsStore } from './store/index'

export { TeamsStore }

export default class CapabilityMicrosoftTeams {
  app: BotAdapterApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  constructor(
    app: BotAdapterApp & {
      bot: BotCommand
      msgraph: MSGraphStore
      store: Sync247Store
      carrier: Carrier
      teams: TeamsStore
    }
  ) {
    this.app = app

    app.use(BotAdapterMiddleware, 'BotAdapterMiddleware')

    app.botadapter.onTurnError = async (context, error) => {
      console.error(error)
    }

    app.use(TeamsStoreMsTeams, 'TeamsStoreMsTeams')

    app.post('/client/v1.0.0/msbot/api/messages', async (context, next) => {
      try {
        await app.botadapter.invokeActivity(context, next)
      } catch (ex) {
        console.error(ex)
      }
    })
  }
}
