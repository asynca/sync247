import {
  BotAdapterApp,
  ChannelInfo,
  TeamInfo,
  ChannelAccount,
  IopaBotAdapterContext
} from 'iopa-botadapter'

import { BotCommand } from 'iopa-botcommander'

export class TeamsEventHandlers {
  // TO DO SWITCH TO EVENT HANDLERS, NOT BOT COMMANDS

  constructor(app: BotAdapterApp & { bot: BotCommand }) {
    app.botadapter.onTeamsChannelRenamedEvent(
      async (
        context: IopaBotAdapterContext,
        channelInfo: ChannelInfo,
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        await app.bot.invoke('urn:com.sync247:ChannelRenamed', context, {
          channelInfo,
          teamInfo
        })
        return next()
      }
    )

    app.botadapter.onTeamsChannelCreatedEvent(
      async (
        context: IopaBotAdapterContext,
        channelInfo: ChannelInfo,
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        await app.bot.invoke('urn:com.sync247:ChannelCreated', context, {
          channelInfo,
          teamInfo
        })
        return next()
      }
    )

    app.botadapter.onTeamsChannelDeletedEvent(
      async (
        context: IopaBotAdapterContext,
        channelInfo: ChannelInfo,
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        await app.bot.invoke('urn:com.sync247:ChannelDeleted', context, {
          channelInfo,
          teamInfo
        })
        return next()
      }
    )

    app.botadapter.onTeamsTeamRenamedEvent(
      async (
        context: IopaBotAdapterContext,
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        await app.bot.invoke('urn:com.sync247:TeamRenamed', context, {
          teamInfo
        })
        return next()
      }
    )

    app.botadapter.onTeamsMembersAddedEvent(
      async (
        context: IopaBotAdapterContext,
        membersAdded: ChannelAccount[],
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        if (
          membersAdded[0].id === context['bot.Capability'].activity.recipient.id
        ) {
          await app.bot.invoke('urn:com.sync247:TeamAdded', context, {
            bot: membersAdded[0],
            teamInfo: {
              id: teamInfo.id,
              name: teamInfo.name,
              global_id: teamInfo.aadGroupId
            }
          })

          membersAdded.shift()
        }

        if (membersAdded.length > 0) {
          await app.bot.invoke('urn:com.sync247:TeamMembersAdded', context, {
            members: membersAdded,
            teamInfo,
            'bot.Provider': context['bot.Provider']
          })
        }

        return next()
      }
    )

    app.botadapter.onTeamsMembersRemovedEvent(
      async (
        context: IopaBotAdapterContext,
        membersAdded: ChannelAccount[],
        teamInfo: TeamInfo,
        next: () => Promise<void>
      ): Promise<void> => {
        await app.bot.invoke('urn:com.sync247:TeamMembersRemoved', context, {
          members: membersAdded,
          teamInfo
        })
        return next()
      }
    )
  }
}

export default TeamsEventHandlers
