import { RouterApp, IopaContext, IopaBotContext } from 'iopa-types'
import { EdgeApp } from '@iopa-edge/types'
import { BotCommanderMiddleware, BotCommand } from 'iopa-botcommander'

import { IopaBotAdapterContext } from 'iopa-botadapter-types'
import { URN_BOTADAPTER, Adapter as BotFrameworkAdapter } from 'iopa-botadapter'
import { URN_CARRIER, Carrier } from 'iopa-carrier'
import { constants as IOPA } from 'iopa'

import Router from 'iopa-router'
import CapabilitySync247Store, {
  Sync247Store
} from '@sync247/capability-sync247-store'
import CapabilityCarrier from '@sync247/capability-carrier'
import CapabilityTeams, { TeamsStore } from '@sync247/capability-teams'
import CapabilityMicrosoftGraph, {
  MSGraphStore
} from '@sync247/capability-msgraph'
import SkillProvision from '@sync247/skill-provision'
import SkillMembership from '@sync247/skill-membership'
import SkillTeamsToSms from '@sync247/skill-teams-to-sms'
import SkillSmsToTeams from '@sync247/skill-sms-to-teams'
import SkillVoiceToVoice from '@sync247/skill-voice-to-voice'
import SkillTeamsToVoice from '@sync247/skill-teams-to-voice'

const { name, version } = require('../package.json')

export default function (
  app: EdgeApp & {
    bot: BotCommand
    botadapter: BotFrameworkAdapter
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }
): void {
  // Default Iopa App (catch-all)
  app[IOPA.APPBUILDER.DefaultApp] = async (context: IopaBotContext, next) => {
    if (context['bot.Source'] === URN_BOTADAPTER) {
      const botCapabilityContext = context as IopaBotAdapterContext
      console.log(
        `Bot activity ${botCapabilityContext['bot.Provider']} ${botCapabilityContext['bot.ActivityType']}`
      )
      void context.response.end({ status: 200 })
    } else if (context['bot.Source'] === URN_CARRIER) {
      void context.response.end(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200 }
      )
    } else {
      context.response['iopa.StatusCode'] = 404
      void context.response.end('SYNC247-404 Resource was not found')
    }
  }

  // Core capabilities
  app.use(Router, 'Router')
  app.use(CapabilitySync247Store, 'CapabilitySync247Store')
  app.use(CapabilityMicrosoftGraph, 'CapabilityMicrosoftGraph')

  // Bot pipeline, after core, before application
  app.use(CapabilityTeams, 'CapabilityTeams')
  app.use(CapabilityCarrier, 'CapabilityCarrier')

  // Teams sub-App
  const teamsApp = app.fork(
    (context: IopaBotContext) =>
      context['bot.Provider'] === 'msteams' ||
      context['bot.Provider'] === 'emulator'
  ) as EdgeApp & {
    bot: BotCommand
    botadapter: BotFrameworkAdapter
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  teamsApp.carrier = app.carrier
  teamsApp.db = app.db
  teamsApp.botadapter = app.botadapter

  teamsApp
    .use(BotCommanderMiddleware, 'BotCommanderMiddleware')
    .use(SkillProvision, 'SkillProvision')
    .use(SkillMembership, 'SkillMembership')
    .use(SkillTeamsToSms, 'SkillTeamsToSms')
    .use(SkillTeamsToVoice, 'SkillTeamsToVoice')
  ;['botadapter', 'msgraph', 'store', 'carrier', 'teams'].forEach((prop) => {
    teamsApp[prop] = app[prop]
  })

  app.bot = teamsApp.bot

  // SMS sub-App
  const smsApp = app.fork(
    (context: IopaBotContext) =>
      context['bot.Provider'] === 'signalwire' ||
      context['bot.Provider'] === 'twilio'
  ) as EdgeApp & {
    bot: BotCommand
    botadapter: BotFrameworkAdapter
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  ;['bot', 'botadapter', 'msgraph', 'store', 'carrier', 'teams'].forEach(
    (prop) => {
      smsApp[prop] = app[prop]
    }
  )

  smsApp.carrier = app.carrier
  smsApp.botadapter = app.botadapter
  smsApp.db = app.db
  smsApp.bot = app.bot

  smsApp
    .use(SkillVoiceToVoice, 'SkillVoiceToVoice')
    .use(SkillSmsToTeams, 'SkillSmsToTeams')

  // Main App
  app.use(VersionPlugin, 'VersionPlugin')
}

class VersionPlugin {
  public constructor(app: RouterApp<{}, IopaContext>) {
    app.get('/client/v1.0.0/version', (context: IopaContext) => {
      console.log('dev')
      return context.response.send(
        `CloudFlare ${process.env.NODE_ENV} ${context['iopa.Url'].hostname} package ${name} version ${version}`
      )
    })
  }
}
