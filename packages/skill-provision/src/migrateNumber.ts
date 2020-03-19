import { Sync247Store } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { TeamChannelLinkCard } from '@sync247/common-cards'
import { EdgeApp } from '@iopa-edge/types'
import { IopaBotAdapterContext, MessageFactory } from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier } from 'iopa-carrier'

export default async function migrateNumber(
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  },
  context: IopaBotAdapterContext,
  virtualNumber: string
): Promise<void> {
  try {
    virtualNumber = `+${virtualNumber}`

    const teamRecord = await app.store.getVirtualNumberTeam({
      virtualNumber
    })

    if (!teamRecord) {
      await context.response.send(
        `Could not find ${virtualNumber} as a provisioned number;   please check the number`
      )
      return
    }

    teamRecord.virtualNumber = virtualNumber

    if (teamRecord.carrierProvider !== 'twilio') {
      await context.response.send(
        `Migration of virtual numbers between environments is only supported for twilio;  use unprovision command instead and manually move the number in the ${teamRecord.carrierProvider} portal`
      )
      return
    }

    await context.response.send(
      `OK, migrating ${app.carrier.beautifyNumber(virtualNumber)} assigned to ${
        teamRecord.userName
      }`
    )

    await app.store.deleteTeam(teamRecord)

    const provisionedNumberDetails = await app.carrier.getIncomingPhoneNumber(
      teamRecord.carrierProvider,
      virtualNumber
    )

    await app.carrier.updateIncomingPhoneNumber(
      teamRecord.carrierProvider,
      provisionedNumberDetails.sid,
      {
        friendly_name: `${provisionedNumberDetails.friendly_name.replace(
          /^[^+0-9(]*/,
          ''
        )}`
      }
    )

    await app.carrier.migrateIncomingPhoneNumber(
      teamRecord.carrierProvider,
      provisionedNumberDetails.sid
    )

    const partialTeamSiteName = `sync ${app.carrier
      .beautifyNumber(virtualNumber)
      .replace(/^\+/, '')}`

    const teamSiteName = `${partialTeamSiteName} UNPROVISIONED`

    await app.msgraph.updateTeam({
      groupId: teamRecord.teamGlobalId,
      name: teamSiteName,
      description: `Deprovisioned Sync24-7 environment`
    })

    let found = false

    await app.teams.sendToExistingOrNewTeamsChannel(
      {
        provider: teamRecord['bot.Provider'],
        groupId: teamRecord.teamGlobalId,
        channelDescriptor: null /** General */,
        channelName: 'General',
        botId: teamRecord.userLocalId,
        serviceUrl: teamRecord['bot.ServiceUrl'],
        activity: MessageFactory.text(
          `The virtual number ${provisionedNumberDetails.friendly_name} has been unprovisioned, pending migration`
        )
      },
      async (ctx) => {
        try {
          await app.msgraph.deleteThisAppFromTeam(teamRecord.teamGlobalId)
        } catch (ex) {
          console.error(ex)
        }
        found = true
        await context.response.send(
          TeamChannelLinkCard({
            text: `Migration removal from ${process.env.NODE_ENV} complete;  please switch to target environment and reprovision`,
            label: teamRecord.teamName,
            'bot.Team': {
              id: teamRecord.teamId,
              globalid: teamRecord.teamGlobalId
            },
            'bot.Channel': ctx['bot.Channel'],
            tenant: process.env.MSAPP_TENANT
          })
        )
      }
    )

    if (!found) {
      await context.response.send(
        `Migration removal from ${process.env.NODE_ENV} complete;  please switch to target environment and reprovision`
      )
    }
  } catch (ex) {
    context.error(ex)
    await context.response.send(
      `An error occurred during migration: ${ex.message}`
    )
  }
}
