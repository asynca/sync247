/** @jsx ReactiveCards.h */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as ReactiveCards from 'reactive-cards' // required for certain build packagers

import { Sync247Store } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { EdgeApp } from '@iopa-edge/types'
import {
  CardFactory,
  IopaBotAdapterContext,
  MessageFactory
} from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier } from 'iopa-carrier'
import { TeamLinkCard } from '@sync247/common-cards'

export async function showVoicemail(
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  },
  context: IopaBotAdapterContext,
  data: {
    virtualNumber: string
  }
): Promise<void> {
  let { virtualNumber } = data

  virtualNumber = app.carrier.cleanNumber(virtualNumber)

  const teamRecord = await app.store.getVirtualNumberTeam({
    virtualNumber: `+${virtualNumber}`
  })

  if (!teamRecord || !teamRecord.physicalNumber) {
    await context.response.send(
      `The virtual number ${app.carrier.beautifyNumber(
        virtualNumber
      )} was not found`
    )
    return
  }

  await context.response.send(
    `Voicemail for ${
      teamRecord.userName
    } associated with virtual number ${app.carrier.beautifyNumber(
      virtualNumber
    )} and physical number ${app.carrier.beautifyNumber(
      teamRecord.physicalNumber
    )} is 
${teamRecord.voicemailText || ' set to default for the organization'}`
  )
}

export async function setVoicemail(
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  },
  context: IopaBotAdapterContext,
  data: {
    virtualNumber: string
    voicemailText: string
  }
): Promise<void> {
  const { voicemailText } = data
  let { virtualNumber } = data

  virtualNumber = `+${app.carrier.cleanNumber(virtualNumber)}`

  const teamRecord = await app.store.getVirtualNumberTeam({
    virtualNumber
  })

  if (!teamRecord || !teamRecord.physicalNumber) {
    await context.response.send(
      `The virtual number ${app.carrier.beautifyNumber(
        virtualNumber
      )} was not found`
    )
    return
  }

  teamRecord.virtualNumber = virtualNumber

  teamRecord.voicemailText = voicemailText

  try {
    await app.store.registerOrUpdateVirtualNumberTeam({
      virtualNumber,
      voicemailText
    })
  } catch (ex) {
    await context.response.send(
      `Cannot update voicemail in the database;  ${ex.message}`
    )
    return
  }

  const card = (
    <card>
      <body>
        <text size="extraLarge">Voicemail Updated</text>
        <text>Updated details in the sync24-7 contact center</text>
        <factset>
          <fact
            title="Virtual"
            value={app.carrier.beautifyNumber(teamRecord.virtualNumber)}
          />
          <fact title="Provider" value={teamRecord.carrierProvider} />
          <fact
            title="Mobile"
            value={app.carrier.beautifyNumber(teamRecord.physicalNumber)}
          />
          <fact title="Specialist" value={teamRecord.userName} />
          <fact
            title="Voicemail"
            value={teamRecord.voicemailText || 'default'}
          />
          <fact title="Env" value={process.env.NODE_ENV} />
        </factset>
      </body>
    </card>
  )

  await app.teams.sendToExistingOrNewTeamsChannel(
    {
      provider: teamRecord['bot.Provider'],
      groupId: teamRecord.teamGlobalId,
      channelDescriptor: null /** General */,
      channelName: 'General',
      botId: teamRecord.userLocalId,
      serviceUrl: teamRecord['bot.ServiceUrl'],
      activity: MessageFactory.attachment(CardFactory.reactiveCard(card))
    },
    async (ctx) => {
      /** noop */
    }
  )

  await context.response.send(
    TeamLinkCard({
      title: 'Voicemail updated',
      text: `Updated voicemail for ${
        teamRecord.userName
      } on virtual number ${app.carrier.beautifyNumber(
        virtualNumber
      )} and physical number ${app.carrier.beautifyNumber(
        teamRecord.physicalNumber
      )}`,
      label: teamRecord.teamName,
      'bot.Team': {
        id: teamRecord.teamId,
        globalid: teamRecord.teamGlobalId
      },
      tenant: process.env.MSAPP_TENANT
    })
  )
}
