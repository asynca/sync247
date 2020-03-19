import { Sync247Store } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { EdgeApp } from '@iopa-edge/types'
import { IopaBotAdapterContext, CardFactory } from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier, CARRIER_PROVIDER } from 'iopa-carrier'

export default async function provisionNumber(
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
    provider: CARRIER_PROVIDER
  }
): Promise<void> {
  let {
    member: userLocalId,
    virtualnumber: virtualNumber,
    // eslint-disable-next-line prefer-const
    provider: carrierProvider
  } = data

  virtualNumber = app.carrier.cleanNumber(virtualNumber)

  await context.response.send(
    `Provisioning ${app.carrier.beautifyNumber(
      virtualNumber
    )} on ${carrierProvider}`
  )

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
        `Sorry, could not find user details in the key-value store;  try removing and adding user from sync24-7 team again`
      )
      return
    }

    userGlobalId = getProviderSpecialistResponse.userGlobalId
  }

  const user = await app.msgraph.getMemberProfile(userGlobalId)

  if (!user.mobilePhone || user.mobilePhone.length < 10) {
    await context.response.send(
      `Provisioned specialist must have a physical mobile number set in Active Directory.  Please update using Microsoft|365 admin portal and try again.`
    )
    return
  }

  const physicalNumber = `+${app.carrier.cleanNumber(user.mobilePhone)}`

  const provisionedNumberDetails = await app.carrier.getIncomingPhoneNumber(
    carrierProvider,
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

  if (
    !provisionedNumberDetails.capabilities.sms ||
    !provisionedNumberDetails.capabilities.voice
  ) {
    await context.response.send(
      `That number is not both voice and SMS enabled;  please try a different one`
    )
    return
  }

  await context.response.send(
    `Found virtual number ${provisionedNumberDetails.friendly_name}`
  )

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

  // Double check virtual number is not already provisioned

  const getVirtual = await app.store.getVirtualNumberTeam({
    virtualNumber: `+${virtualNumber}`
  })

  if (getVirtual) {
    await context.response.send(
      `The virtual number ${app.carrier.beautifyNumber(
        virtualNumber
      )} on this account is already a provisioned to ${
        getVirtual.userName
      }; please unprovision it first before provisioning it again`
    )
    return
  }

  const finalProvisionedNumberDetails = await app.carrier.updateIncomingPhoneNumber(
    carrierProvider,
    provisionedNumberDetails.sid,
    {
      friendly_name: `${
        user.displayName
      } ${provisionedNumberDetails.friendly_name.replace(/^[^+(0-9]*/, '')}`
    }
  )

  virtualNumber = finalProvisionedNumberDetails.phone_number

  await context.response.send(
    `Updated virtual number to ${
      finalProvisionedNumberDetails.friendly_name
    } and pairing to physical number ${app.carrier.beautifyNumber(
      physicalNumber
    )}`
  )

  try {
    await app.msgraph.updateMemberProfile({
      uid: userGlobalId,
      businessPhones: [virtualNumber]
    })
  } catch (ex) {
    if (ex.statusCode === 403) {
      await context.response.send(
        `Cannot update business phones field for "${user.displayName}" in the Azure AD;  this is for cosmetic purposes only, but you may wish to do so in the Microsoft|365 admin portal.  You shouldn't see this message for non administrator accounts.`
      )
    } else {
      console.error(ex)
      return
    }
  }

  const partialTeamSiteName = `sync ${app.carrier
    .beautifyNumber(virtualNumber)
    .replace(/^\+/, '')}`

  let teamSiteName = `${partialTeamSiteName} ${user.surname}`

  if (process.env.NODE_ENV === 'staging') {
    teamSiteName += '-staging'
  } else if (process.env.NODE_ENV === 'development') {
    teamSiteName += '-dev'
  }

  await app.db
    .collection('temp')
    .doc(teamSiteName)
    .set({
      carrierProvider,
      userGlobalId,
      'bot.conversation': JSON.stringify(context['bot.Conversation']),
      virtualNumber,
      physicalNumber,
      userName: user.displayName,
      userGivenName: user.givenName,
      userSurname: user.surname,
      role: 'provisioned'
    })

  const existingTeams = await app.msgraph.getTeamByDisplayName({
    displayName: partialTeamSiteName
  })

  if (!existingTeams || existingTeams.length === 0) {
    const card = CardFactory.heroCard(
      'Creating Team',
      `Creating a new team site "${teamSiteName}" for ${user.displayName}.   This may take up to twenty minutes to complete.`
    )

    await Promise.all([
      context.response.send(card),
      app.msgraph.createTeam(
        {
          name: teamSiteName,
          description: `Provisioned Sync24-7 environment for ${user.displayName}, ${user.jobTitle} ${process.env.NODE_ENV}`
        },
        async (text) => {
          console.log(text)
        }
      )
    ])
  } else {
    const [existingTeam] = existingTeams

    const card = CardFactory.heroCard(
      'Updated Team',
      `Updated team site "${existingTeam.displayName}" for ${user.displayName}`
    )

    await app.msgraph.deleteThisAppFromTeam(existingTeam.id)

    await app.msgraph.updateTeam({
      groupId: existingTeam.id,
      name: teamSiteName,
      description: `Provisioned Sync24-7 environment for ${user.displayName}, ${user.jobTitle} ${process.env.NODE_ENV}`
    })

    await app.msgraph.addThisAppToTeam(existingTeam.id)

    await context.response.send(card)
  }
}
