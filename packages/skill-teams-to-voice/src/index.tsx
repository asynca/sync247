import { BotCommand } from 'iopa-botcommander'
import {
  IopaBotAdapterContext,
  MessageFactory,
  Adapter as BotFrameworkAdapter
} from 'iopa-botadapter'
import { EdgeApp } from '@iopa-edge/types'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { TeamsStore } from '@sync247/capability-teams'
import { Carrier } from 'iopa-carrier-types'

import { TeamChannelLinkCard } from '@sync247/common-cards'

export default class {
  app: EdgeApp & {
    bot: BotCommand
    botadapter: BotFrameworkAdapter
    carrier: Carrier
    msgraph: MSGraphStore
    store: Sync247Store
    teams: TeamsStore
  }

  constructor(
    app: EdgeApp & {
      bot: BotCommand
      botadapter: BotFrameworkAdapter
      carrier: Carrier
      msgraph: MSGraphStore
      store: Sync247Store
      teams: TeamsStore
    }
  ) {
    this.app = app

    app.bot
      .command('call [number]')
      .alias('voice')
      .description('Start a voice call with a new or existing participant')
      .action(async (context: IopaBotAdapterContext, data) => {
        const teamId = context['bot.Team'].id

        if (!teamId) {
          /** 1 on 1 chat */
          await this.findTeamCreateVoiceCall(context, data)
          return
        }

        const teamRecord = await this.app.store.getTeam({ teamId })

        if (!teamRecord || !teamRecord.virtualNumber) {
          await this.findTeamCreateVoiceCall(context, data)
          return
        }

        // On a provisioned team

        const channel = await this.app.msgraph.getChannel({
          groupid: teamRecord.teamGlobalId,
          channelid: context['bot.Channel'].id
        })

        if (!data.number) {
          if (!/^\d+$/.test(channel.description)) {
            await context.response.send(
              `[sync24-7] To voice call a parcipant you must either provide a number to dial, or invoke the "call"/"voice" command on a participant channel not [${channel.description}]`
            )
            return
          }

          // On a provisioned team and participant numeric channel, no number provided as expected; call this participant

          const recipientNumber = channel.description

          await context.response.send(
            `Ok, creating a voice call from ${this.app.carrier.beautifyNumber(
              teamRecord.physicalNumber
            )} to ${this.app.carrier.beautifyNumber(recipientNumber)} `
          )

          await this.app.carrier.clickToCall({
            provider: teamRecord.carrierProvider,
            baseUrl: this.app.carrier.getBaseUrl(context),
            physicalNumber: teamRecord.physicalNumber,
            virtualNumber: teamRecord.virtualNumber,
            recipientNumber
          })
        } else {
          if (!/^\d+$/.test(channel.description)) {
            // On a general or alphanumeric non-participant channel of a provisioned team
            await this.callFromExistingOrNewTeamsChannel(
              context,
              data,
              teamRecord
            )
            return
          }

          const recipientNumber = app.carrier.cleanNumber(data.number)

          if (app.carrier.cleanNumber(data.number) !== channel.description) {
            await context.response.send(
              `When used in conjuction with a number [${data.number}], the "voice"/"call" command should be requested from the *General* channel or 1-on-bot chat.  To avoid confusion, I haven't initiated a call so please try this command again without the number to call the participant identified by this channel or try again with the number from the general channel or 1 on 1 chat`
            )

            return
          }

          // OK, on a provisioned team and participant numeric channel, and number provided matches the channel

          await context.response.send(
            `Ok, creating a voice call from ${this.app.carrier.beautifyNumber(
              teamRecord.physicalNumber
            )} to ${this.app.carrier.beautifyNumber(
              recipientNumber
            )};  next time you don't need to retype the participant's phone number if the "call"/"voice" command is used on a participant channel like this `
          )

          await this.app.carrier.clickToCall({
            provider: teamRecord.carrierProvider,
            baseUrl: this.app.carrier.getBaseUrl(context),
            physicalNumber: teamRecord.physicalNumber,
            virtualNumber: teamRecord.virtualNumber,
            recipientNumber
          })
        }
      })
  }

  /**
   * Create a new participant channel on the senders individual sync team
   */
  private async findTeamCreateVoiceCall(
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
      console.error(
        `[skill-teams-to-voice] Could not find specialist in KV: ${JSON.stringify(
          {
            'bot.Provider': context['bot.Provider'],
            userLocalId: context['bot.From'].localid
          }
        )} ${JSON.stringify(getProviderSpecialistResponse)}`
      )

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
    await this.callFromExistingOrNewTeamsChannel(context, data, teamRecord)
  }

  /**
   * Create a new participant channel on the senders individual sync team
   */
  private async callFromExistingOrNewTeamsChannel(
    context: IopaBotAdapterContext,
    data: any,
    teamRecord: TeamRecord
  ): Promise<void> {
    const recipientNumber = `+${this.app.carrier.cleanNumber(data.number)}`
    await context.response.send(
      `Ok, creating a voice call from ${this.app.carrier.beautifyNumber(
        teamRecord.physicalNumber
      )} to ${this.app.carrier.beautifyNumber(recipientNumber)} `
    )
    const activity = MessageFactory.text(
      `Initiating voice call from ${this.app.carrier.beautifyNumber(
        teamRecord.physicalNumber
      )} to ${this.app.carrier.beautifyNumber(recipientNumber)} `
    )

    try {
      await this.app.teams.sendToExistingOrNewTeamsChannel(
        {
          provider: teamRecord['bot.Provider'],
          groupId: teamRecord.teamGlobalId,
          channelDescriptor: recipientNumber.replace(/^\+/, ''),
          channelName: this.app.carrier
            .beautifyNumber(recipientNumber)
            .replace(/^\+/, ''),
          botId: teamRecord.userLocalId,
          serviceUrl: teamRecord['bot.ServiceUrl'],
          activity
        },
        async (ctx) => {
          await this.app.carrier.clickToCall({
            provider: teamRecord.carrierProvider,
            baseUrl: this.app.carrier.getBaseUrl(context),
            physicalNumber: teamRecord.physicalNumber,
            virtualNumber: teamRecord.virtualNumber,
            recipientNumber
          })

          if (context['bot.Channel'].id !== ctx['bot.Channel'].id) {
            await context.response.send(
              TeamChannelLinkCard({
                text: `Voice call with ${this.app.carrier.beautifyNumber(
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
}
