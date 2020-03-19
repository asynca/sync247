/** @jsx ReactiveCards.h */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as ReactiveCards from 'reactive-cards' // required for certain build packagers

import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { TeamLinkCard } from '@sync247/common-cards'
import { EdgeApp } from '@iopa-edge/types'
import {
  CardFactory,
  IopaBotAdapterContext,
  MessageFactory
} from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier } from 'iopa-carrier'

export default async function reassignNumber(
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  },
  context: IopaBotAdapterContext,
  data: {
    member: string
    virtualnumber: string
  }
): Promise<void> {
  let { member: userLocalId, virtualnumber: virtualNumber } = data

  try {
    virtualNumber = `+${virtualNumber}`

    // FIND TEAM RECORD FOR EXISTING ASSIGNMENT

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

    // FIND NEW ASSIGNMENT SPECIALIST DETAILS FROM BOT PROVIDER (i.e., TEAMS) AND THEN MSGRAPH

    let userGlobalId: string

    if (userLocalId === 'self') {
      userLocalId = context['bot.From'].localid
      userGlobalId = context['bot.From'].id
    } else {
      const getProviderSpecialistResponse = await app.store.getProviderSpecialist(
        {
          'bot.Provider': context['bot.Provider'],
          userLocalId
        }
      )

      if (
        !getProviderSpecialistResponse ||
        !getProviderSpecialistResponse.userGlobalId
      ) {
        await context.response.send(
          `Sorry, could not find specialist details in the provider-specialist key-value store;  try removing and adding user from sync24-7 team again`
        )
        return
      }

      userGlobalId = getProviderSpecialistResponse.userGlobalId
    }

    const specialist = await app.store.getSpecialist({
      userGlobalId
    })

    if (!specialist) {
      await context.response.send(
        `Sorry, could not find specialist details in the specialist key-value store;  try removing and adding user from sync24-7 team again`
      )
      return
    }

    const user = await app.msgraph.getMemberProfile(userGlobalId)

    if (!user.mobilePhone || user.mobilePhone.length < 10) {
      await context.response.send(
        `Provisioned specialist must have a physical mobile number set in Active Directory.  Please update using Microsoft|365 admin portal and try again.`
      )
      return
    }

    const physicalNumber = `+${app.carrier.cleanNumber(user.mobilePhone)}`

    await context.response.send(
      `OK, reassigning ${app.carrier.beautifyNumber(
        virtualNumber
      )} currently assigned to ${teamRecord.userName} to ${
        user.displayName
      } and associating with new physical number ${physicalNumber}`
    )

    /// /  REASSIGN

    const provisionedNumberDetails = await app.carrier.getIncomingPhoneNumber(
      teamRecord.carrierProvider,
      virtualNumber
    )

    if (!provisionedNumberDetails) {
      await context.response.send(
        `Could not find exactly one match to that number in your account;   please check the number`
      )
      return
    }

    provisionedNumberDetails.friendly_name =
      provisionedNumberDetails.friendly_name ||
      app.carrier.beautifyNumber(provisionedNumberDetails.phone_number)

    // Double check physical number is not a virtual number

    const getPhysical = await app.store.getVirtualNumberTeam({
      virtualNumber: physicalNumber
    })

    if (getPhysical) {
      await context.response.send(
        `The mobile number ${app.carrier.beautifyNumber(
          physicalNumber
        )} on this account is already a provisioned number for ${
          getPhysical.userName
        }; I cannot provision to it or I might get in an infinite loop;  please update the Microsoft|365 user profile mobile number to a real world number`
      )
      return
    }

    const finalProvisionedNumberDetails = await app.carrier.updateIncomingPhoneNumber(
      teamRecord.carrierProvider,
      provisionedNumberDetails.sid,
      {
        friendly_name: `${
          user.displayName
        } ${provisionedNumberDetails.friendly_name.replace(/^[^+(0-9]*/, '')}`
      }
    )

    virtualNumber = finalProvisionedNumberDetails.phone_number

    try {
      await app.msgraph.updateMemberProfile({
        uid: userGlobalId,
        businessPhones: [virtualNumber]
      })
    } catch (ex) {
      if (ex.statusCode === 403) {
        /** silently ignore for administrator */
      } else {
        console.error(ex)
      }
    }

    const partialTeamSiteName = `sync ${app.carrier
      .beautifyNumber(virtualNumber)
      .replace(/^\+/, '')}`

    let teamSiteName = `${partialTeamSiteName} ${user.surname}`

    if (process.env.NODE_ENV === 'staging') {
      teamSiteName += '-staging'
    } else if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'localhost'
    ) {
      teamSiteName += '-dev'
    }

    const existingTeams = await app.msgraph.getTeamByDisplayName({
      displayName: partialTeamSiteName
    })

    if (!existingTeams || existingTeams.length === 0) {
      await context.response.send(
        `Could not find an existing team with a name starting ${partialTeamSiteName}, unable to reassign`
      )
      return
    }
    const [existingTeam] = existingTeams

    const newTeamRecord: TeamRecord = {
      ...teamRecord,
      teamId: teamRecord.teamId,
      teamName: teamSiteName,
      teamGlobalId: teamRecord.teamGlobalId,
      carrierProvider: teamRecord.carrierProvider,
      userGlobalId,
      virtualNumber,
      physicalNumber,
      userName: user.displayName,
      userGivenName: user.givenName,
      userSurname: user.surname,
      role: 'provisioned'
    }

    await app.msgraph.updateTeam({
      groupId: existingTeam.id,
      name: teamSiteName,
      description: `Provisioned Sync24-7 environment for ${user.displayName}, ${user.jobTitle} ${process.env.NODE_ENV}`
    })

    try {
      await app.msgraph.addMemberToTeam({
        groupid: newTeamRecord.teamGlobalId,
        uid: userGlobalId
      })
      console.log('Added member to team')
    } catch (ex) {
      // ignore as likely already exists
    }

    await app.store.registerOrUpdateTeam(newTeamRecord)
    await app.store.registerOrUpdateVirtualNumberTeam(newTeamRecord)

    await app.store.registerSpecialist({
      userGlobalId: newTeamRecord.userGlobalId,
      virtualNumber: newTeamRecord.virtualNumber,
      provisionedNumbers: ((specialist && specialist.provisionedNumbers) || [])
        .concat(newTeamRecord.virtualNumber)
        .filter(onlyUnique)
    })

    const card = (
      <card>
        <body>
          <text size="extraLarge">Reassignment</text>
          <text>Reassignment in the sync24-7 contact center</text>
          <factset>
            <fact
              title="Virtual"
              value={app.carrier.beautifyNumber(newTeamRecord.virtualNumber)}
            />
            <fact title="Provider" value={newTeamRecord.carrierProvider} />
            <fact
              title="Mobile"
              value={app.carrier.beautifyNumber(newTeamRecord.physicalNumber)}
            />
            <fact title="Specialist" value={newTeamRecord.userName} />
            <fact
              title="Voicemail"
              value={newTeamRecord.voicemailText || 'default'}
            />
            <fact title="Env" value={process.env.NODE_ENV} />
          </factset>
        </body>
      </card>
    )

    await app.teams.sendToExistingOrNewTeamsChannel(
      {
        provider: newTeamRecord['bot.Provider'],
        groupId: newTeamRecord.teamGlobalId,
        channelDescriptor: null /** General */,
        channelName: 'General',
        botId: newTeamRecord.userLocalId,
        serviceUrl: newTeamRecord['bot.ServiceUrl'],
        activity: MessageFactory.attachment(CardFactory.reactiveCard(card))
      },
      async (ctx) => {
        /** noop */
      }
    )

    await context.response.send(
      TeamLinkCard({
        title: 'Team updated',
        text: `Team has been succesfully updated for ${newTeamRecord.userName} ; you may wish to remove ${teamRecord.userName} from the team membership roster`,
        label: newTeamRecord.teamName,
        'bot.Team': {
          id: newTeamRecord.teamId,
          globalid: newTeamRecord.teamGlobalId
        },
        tenant: process.env.MSAPP_TENANT
      })
    )
  } catch (ex) {
    context.error(ex)
    await context.response.send(
      `An error occurred during reassignment: ${ex.message}`
    )
  }
}

function onlyUnique(
  value: string,
  index: number,
  self: Array<string>
): boolean {
  return self.indexOf(value) === index
}
