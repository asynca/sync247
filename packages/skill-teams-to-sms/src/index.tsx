import { BotCommand } from 'iopa-botcommander'
import {
  IopaBotAdapterContext,
  CardFactory,
  MessageFactory,
  Adapter as BotFrameworkAdapter
} from 'iopa-botadapter'
import { EdgeApp } from '@iopa-edge/types'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { Carrier } from 'iopa-carrier-types'

import { TeamsStore } from '@sync247/capability-teams'
import { TeamChannelLinkCard, SmsCard } from '@sync247/common-cards'

export default class {
  app: EdgeApp & {
    bot: BotCommand
    botadapter: BotFrameworkAdapter
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  constructor(
    app: EdgeApp & {
      bot: BotCommand
      botadapter: BotFrameworkAdapter
      msgraph: MSGraphStore
      store: Sync247Store
      carrier: Carrier
      teams: TeamsStore
    }
  ) {
    this.app = app

    app.bot
      .command('sms <number> [text...]')
      .description(
        'Start an SMS conversation with a new or existing participant'
      )
      .action(async (context: IopaBotAdapterContext, data) => {
        // clean arguments
        const _cleanDataNumber = this.app.carrier.cleanNumber(data.number)
        if (data.number && !isNumeric(_cleanDataNumber)) {
          data.text = `${data.number} ${data.text.join(' ')}`
          data.number = null
        } else {
          data.number = _cleanDataNumber
          data.text = data.text.join(' ')
        }

        // determine where this command is called from
        const teamId = context['bot.Team'].id

        if (!teamId) {
          /** 1 on 1 chat */
          await this.findTeamSendSms(context, data)
          return
        }

        const teamRecord = await this.app.store.getTeam({ teamId })

        if (!teamRecord || !teamRecord.virtualNumber) {
          await this.findTeamSendSms(context, data)
          return
        }

        // On a provisioned team
        const channel = await this.app.msgraph.getChannel({
          groupid: teamRecord.teamGlobalId,
          channelid: context['bot.Channel'].id
        })
        const isChannelNumeric = isNumeric(channel.description)

        if (!data.number) {
          // No Recipient Specified

          if (!isChannelNumeric) {
            await context.response.send(
              `[sync24-7] To send an sms to a parcipant you must either provide the recipient's number, or invoke the "sms" command on a participant channel not [${channel.description}]`
            )
            return
          }

          // On a provisioned team and participant numeric channel, no number provided
          if (!data.text) {
            await context.response.send(
              `[sync24-7] You are already on the channel required to send a text;  no need to use the "sms" command when on this channel, ignoring`
            )
            return
          }

          data.number = channel.description

          // On a provisioned team and participant numeric channel, no number provided and text provided as expected; sms this participant
          await this.smsFromExistingOrNewTeamsChannel(context, data, teamRecord)
          return
        }

        // With Recipient Specified

        if (!isChannelNumeric) {
          // On a general or alphanumeric non-participant channel of a provisioned team, valid numeric recipient provided
          await this.smsFromExistingOrNewTeamsChannel(context, data, teamRecord)
          return
        }

        // On a provisioned team and participant numeric channel, recipient number provided
        if (data.number !== channel.description) {
          await context.response.send(
            `When used in conjuction with a number [${data.number}], the "sms" command should be requested from the *General* channel or 1-on-bot chat.  To avoid confusion, I haven't initiated an sms message so please try this command again without the number to sms the participant identified by this channel or try again with the number from the general channel or 1 on 1 chat`
          )
          return
        }

        // On a provisioned team and participant numeric channel, recipient number provided and it matches channel
        await this.smsFromExistingOrNewTeamsChannel(context, data, teamRecord)
      })

    // catch all,  if entered in a provision team and participant channel, means a message to be sent via sms
    app.bot.action(async (context: IopaBotAdapterContext) => {
      const teamId = context['bot.Team'].id

      if (!teamId) {
        await context.response.send(
          `I don't understand what you mean;  try typing help`
        )
        return
      }

      const teamRecord = await this.app.store.getTeam({ teamId })

      if (!teamRecord) {
        await context.response.send(`Unknown command, try telling me 'help'`)
        return
      }

      if (teamRecord.role === 'provisioned') {
        await this.inParticipantChannelSendToSms(context, teamRecord)
        return
      }
      await context.response.send(`Unknown command, try telling me 'help'`)
    })
  }

  /**
   * Create a new sms channel on the senders individual sync team
   */
  private async findTeamSendSms(
    context: IopaBotAdapterContext,
    data: any
  ): Promise<void> {
    const getProviderSpecialistResponse = await this.app.store.getProviderSpecialist(
      {
        'bot.Provider': context['bot.Provider'],
        userLocalId: context['bot.From'].localid
      }
    )

    if (
      !getProviderSpecialistResponse ||
      !getProviderSpecialistResponse.userGlobalId
    ) {
      await context.response.send(
        `Sorry, could not find your sync24-7 details;  please have the administrator remove and add you in the sync24-7 team again`
      )
      return
    }

    const { userGlobalId } = getProviderSpecialistResponse

    const specialist = await this.app.store.getSpecialist({ userGlobalId })

    if (!specialist || !specialist.virtualNumber) {
      await context.response.send(
        `Sorry, could not find a provisioned number for you;  please have the administrator reprovision your virtual number`
      )
      return
    }

    const teamRecord = await this.app.store.getVirtualNumberTeam({
      virtualNumber: specialist.virtualNumber
    })
    await this.smsFromExistingOrNewTeamsChannel(context, data, teamRecord)
  }

  private async smsFromExistingOrNewTeamsChannel(
    context: IopaBotAdapterContext,
    data: any,
    teamRecord: TeamRecord
  ): Promise<void> {
    const recipientNumber = `+${this.app.carrier.cleanNumber(data.number)}`

    void context.response.send(
      `Ok, creating an SMS conversation from ${this.app.carrier.beautifyNumber(
        teamRecord.virtualNumber
      )} to ${this.app.carrier.beautifyNumber(recipientNumber)} `
    )

    const activity = MessageFactory.attachment(
      CardFactory.reactiveCard(
        SmsCard({
          caption: `To ${this.app.carrier.beautifyNumber(
            recipientNumber
          )} From ${this.app.carrier.beautifyNumber(teamRecord.virtualNumber)}`,
          text: data.text
        })
      )
    )

    try {
      await this.app.teams.sendToExistingOrNewTeamsChannel(
        {
          provider: teamRecord['bot.Provider'],
          groupId: teamRecord.teamGlobalId,
          channelName: this.app.carrier
            .beautifyNumber(recipientNumber)
            .replace(/^\+/, ''),
          channelDescriptor: recipientNumber.replace(/^\+/, ''),
          botId: teamRecord.userLocalId,
          serviceUrl: teamRecord['bot.ServiceUrl'],
          activity
        },
        async (ctx) => {
          if (data.text) {
            await this.app.carrier.createSmsConversation(
              teamRecord.carrierProvider,
              teamRecord.virtualNumber,
              recipientNumber,
              async (smscontext) => {
                await smscontext['bot.Capability'].sendActivity(data.text)
              }
            )
          }

          if (context['bot.Channel'].id !== ctx['bot.Channel'].id) {
            await context.response.send(
              TeamChannelLinkCard({
                text: `Conversation with ${this.app.carrier.beautifyNumber(
                  recipientNumber
                )} initiated`,
                label: `View Channel`,
                'bot.Channel': ctx['bot.Channel'],
                tenant: process.env.MSAPP_TENANT,
                'bot.Team': {
                  globalid: teamRecord.teamGlobalId
                }
              })
            )
          }
        }
      )
    } catch (ex) {
      console.error(ex)
    }
  }

  /**
   * Send a new message or reply from a sync-channel in microsoft teams directly to SMS recipient
   */
  async inParticipantChannelSendToSms(
    context: IopaBotAdapterContext,
    teamRecord: TeamRecord
  ): Promise<void> {
    try {
      const channel = await this.app.msgraph.getChannel({
        groupid: teamRecord.teamGlobalId,
        channelid: context['bot.Channel'].id
      })

      if (!/^\d+$/.test(channel.description)) {
        await context.response.send(
          `[sync24-7] Not a recognized command and not on an inbound number channel ${channel.description};  try @sync help for available commands`
        )
        return
      }

      const fromNumber = teamRecord.virtualNumber
      const toNumber = `+${channel.description}`
      const text = context['bot.Text']

      await this.app.carrier.createSmsConversation(
        teamRecord.carrierProvider,
        fromNumber,
        toNumber,
        async (ctx) => {
          try {
            await ctx['bot.Capability'].sendActivity(text)
            console.log(
              `SENT SMS to ${teamRecord.carrierProvider} ${toNumber} from ${fromNumber}`
            )

            await context['bot.Capability'].sendActivity(
              MessageFactory.text(
                String.fromCharCode(0xd83d, 0xdc4d) // :thumbsup:
              )
            )
          } catch (ex) {
            context.error(ex)
            await context['bot.Capability'].sendActivity(
              MessageFactory.text(ex.message)
            )
          }
        }
      )

      await context.response.status(200).end()
    } catch (ex) {
      console.error(ex)
      await context['bot.Capability'].sendActivity(
        MessageFactory.text(ex.message)
      )
      await context.response.status(200).end()
    }
  }
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value)
}
