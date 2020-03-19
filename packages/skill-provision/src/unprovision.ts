/* eslint-disable @typescript-eslint/camelcase */
import { Sync247Store } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { TeamChannelLinkCard } from '@sync247/common-cards'
import { EdgeApp } from '@iopa-edge/types'
import { IopaBotAdapterContext, MessageFactory } from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier } from 'iopa-carrier'

export default async function unprovision(
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  },
  context: IopaBotAdapterContext,
  virtualNumber: string
) {
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

    await context.response.send(
      `OK, unprovisioning ${app.carrier.beautifyNumber(
        virtualNumber
      )} assigned to ${teamRecord.userName}`
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
          `The virtual number ${provisionedNumberDetails.friendly_name} has been unprovisioned by the administrator`
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
            text: `Unprovisioning complete;  it is now safe to delete team`,
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
      await context.response.send(`Unprovisioning complete`)
    }
  } catch (ex) {
    context.error(ex)
    await context.response.send(
      `An error occurred during unprovisioning: ${ex.message}`
    )
  }
}
