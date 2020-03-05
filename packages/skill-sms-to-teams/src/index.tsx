import { CardFactory, MessageFactory, BotAdapterApp } from 'iopa-botadapter'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { TeamsStore } from '@sync247/capability-teams'
import { Carrier, IopaCarrierContext } from 'iopa-carrier-types'
import { SmsCard } from '@sync247/common-cards'

export default class {
  app: BotAdapterApp & {
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  constructor(
    app: BotAdapterApp & {
      msgraph: MSGraphStore
      store: Sync247Store
      carrier: Carrier
      teams: TeamsStore
    }
  ) {
    this.app = app

    app.carrier.onMessage(
      async (
        context: IopaCarrierContext,
        next: () => Promise<void>
      ): Promise<void> => {
        try {
          const virtualNumber = context['bot.Recipient'].localid
          const fromNumber = context['bot.From'].localid
          const text = context['bot.Text']

          const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam(
            { virtualNumber }
          )

          if (!teamRecord) {
            console.error(
              `Unknown team for incoming message to ${virtualNumber}`
            )
            return next()
          }

          console.log(
            `Incoming message from ${fromNumber} for team ${JSON.stringify(
              teamRecord.teamId
            )}`
          )

          const activity = MessageFactory.attachment(
            CardFactory.reactiveCard(
              SmsCard({
                caption: this.app.carrier.beautifyNumber(fromNumber),
                text
              })
            )
          )

          /*   if (teamRecord.conversationReference) {
                           const conversationReference: ConversationReference & { timestamp: number } = JSON.parse(teamRecord.conversationReference)
       
                           if (conversationReference.timestamp && (Date.now() - conversationReference.timestamp) < (1000 * 60 * 10)) {
       
                               await this.app.botadapter.continueConversation(JSON.parse(teamRecord.conversationReference), async (ctx) => {
                                   await ctx["bot.Capability"].sendActivity(activity)
                               })
       
                               return next()
                           }
       
                       } */

          await this.app.teams.sendToExistingOrNewTeamsChannel(
            {
              provider: teamRecord['bot.Provider'],
              groupId: teamRecord.teamGlobalId,
              channelName: this.app.carrier
                .beautifyNumber(fromNumber)
                .replace(/^\+/, ''),
              channelDescriptor: fromNumber.replace(/^\+/, ''),
              botId: teamRecord.userLocalId,
              serviceUrl: teamRecord['bot.ServiceUrl'],
              activity
            },
            () => Promise.resolve()
          )
        } catch (ex) {
          console.error(ex)
          return next()
        }

        return Promise.resolve() // skip remaining message handlers as now processed
      }
    )

    // Catch if unable to process
    app.carrier.onMessage(
      async (
        context: IopaCarrierContext,
        next: () => Promise<void>
      ): Promise<void> => {
        console.log(
          `Unable to process inbound message to ${context['bot.Recipient'].localid}`
        )

        // TODO Save to slack or undeliverable table

        context.response['iopa.StatusCode'] = 500
        context.response['iopa.StatusText'] =
          'Unable to process inbound message'
        void context.response.end(null)
      }
    )
  }
}
