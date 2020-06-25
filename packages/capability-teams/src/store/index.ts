// Common Type definitions to all provider middleware
import { BotAdapterApp } from 'iopa-botadapter'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStoreMethods, TeamsStore } from './types'

// Microsoft Teams specific provider middleware
// Depends on `iopa-botadapter` and `@sync247/capability-msgraph
import { MsTeamsCapability } from './msteams-capability'

export { TeamsStore, TeamsStoreMethods }

export class TeamsStoreMsTeams {
  constructor(
    app: BotAdapterApp & {
      msgraph: MSGraphStore
      teams: TeamsStore
    }
  ) {
    app.teams = new MsTeamsCapability(app)
  }
}
