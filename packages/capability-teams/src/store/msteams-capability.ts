import { MSGraphStore } from '@sync247/capability-msgraph'
import {
  ConversationParameters,
  ConversationReference,
  BotAdapterApp,
  Activity,
  IopaBotAdapterContext
} from 'iopa-botadapter'
import { TeamsEventHandlers } from './msteams-event-handlers'
import { TeamsStore, TeamsStoreMethods } from './index'

export class MsTeamsCapability implements TeamsStore, TeamsStoreMethods {
  app: BotAdapterApp & {
    msgraph: MSGraphStore
    teams: TeamsStore
  }

  constructor(
    app: BotAdapterApp & {
      msgraph: MSGraphStore
      teams: TeamsStore
    }
  ) {
    this.app = app
    this.app.teams = this
    app.use(TeamsEventHandlers, 'TeamsEventHandlers')
  }

  async sendToExistingOrNewTeamsChannel(
    {
      provider,
      groupId,
      botId,
      channelName,
      channelDescriptor,
      serviceUrl,
      activity
    }: {
      provider: string
      groupId: string
      channelDescriptor?: string
      channelName: string
      botId: string
      serviceUrl: string
      activity: Activity
    },
    logic: (context: IopaBotAdapterContext) => Promise<void>
  ): Promise<void> {
    let channel

    try {
      if (provider !== 'msteams') {
        throw new Error(
          `invalid provider, only "msteams" support currently: ${provider}`
        )
      }

      let channels
      if (channelDescriptor) {
        channels = await this.app.msgraph.getChannelByDescription({
          groupid: groupId,
          description: channelDescriptor
        })
      } else {
        channels = await this.app.msgraph.getChannelGeneral({
          groupid: groupId
        })
      }

      if (channels.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        channel = channels[0]
      } else {
        if (!channelDescriptor) {
          throw new Error(`cannot find general channel on team ${groupId} `)
        }
        channel = await this.app.msgraph.createChannel({
          groupid: groupId,
          displayName: channelName,
          description: channelDescriptor
        })
        console.log('channel created')
      }
    } catch (ex) {
      console.error(ex)
    }

    if (!channel) {
      console.log('Could not find channel')
      return
    }
    console.log('Found channel')

    try {
      const conversationParameters = {
        bot: { id: botId },
        isGroup: true,
        channelData: {
          channel: { id: channel.id, name: channel.displayName },
          tenantId: process.env.MSAPP_TENANT
        },
        members: [],
        tenantId: process.env.MSAPP_TENANT,
        serviceUrl
      } as ConversationParameters & ConversationReference

      await this.app.botadapter.createProactiveChannelConversation(
        conversationParameters,
        activity,
        logic
      )
    } catch (ex) {
      console.error(ex)
    }
  }
}

export default MsTeamsCapability
