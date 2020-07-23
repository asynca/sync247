/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards' // required for certain build packagers

import { BotCommand } from 'iopa-botcommander'
import { IopaBotAdapterContext, MessageFactory } from 'iopa-botadapter'
import { ChannelAccount } from 'iopa-botadapter-schema'
import { ChannelInfo, TeamInfo } from 'iopa-botadapter-schema-teams'
import { EdgeApp } from '@iopa-edge/types'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { TeamsStore } from '@sync247/capability-teams'
import {
  TeamChannelLinkCard,
  TeamLinkCard,
  HeroCard
} from '@sync247/common-cards'
import { Carrier } from 'iopa-carrier/src/carrier'
import { CARRIER_PROVIDER } from 'iopa-carrier-types'

export const ReactiveCardsFix = ReactiveCards
// import { default as teamPhoto } from './assets/profile_photo'

export default class {
  constructor(
    app: EdgeApp & {
      bot: BotCommand
      carrier: Carrier
      msgraph: MSGraphStore
      store: Sync247Store
      teams: TeamsStore
    }
  ) {
    app.bot
      .command('urn:com.sync247:ChannelCreated')
      .api(
        async (
          context: IopaBotAdapterContext,
          {
            channelInfo,
            teamInfo
          }: { channelInfo: ChannelInfo; teamInfo: TeamInfo }
        ) => {
          if (/^[\d()\s\-+)]+$/.test(channelInfo.name)) {
            const teamGlobalId =
              teamInfo.aadGroupId ||
              (await app.store.getTeam({ teamId: teamInfo.id })).teamGlobalId

            await context.response.send(
              TeamChannelLinkCard({
                title: `New communication channel opened`,
                label: channelInfo.name,
                'bot.Team': {
                  id: teamInfo.id,
                  globalid: teamGlobalId
                },
                'bot.Channel': channelInfo as any,
                tenant: process.env.MSAPP_TENANT
              })
            )
          }
        }
      )

    app.bot
      .command('urn:com.sync247:TeamRenamed')
      .api(
        async (
          context: IopaBotAdapterContext,
          {
            channelInfo,
            teamInfo
          }: { channelInfo: ChannelInfo; teamInfo: TeamInfo }
        ) => {
          await app.store.registerOrUpdateTeam({
            teamId: teamInfo.id,
            teamName: teamInfo.name
          })
        }
      )

    app.bot.command('urn:com.sync247:TeamMembersAdded').api(
      async (
        context: IopaBotAdapterContext,
        {
          members,
          teamInfo,
          'bot.Provider': botProvider
        }: {
          members: ChannelAccount[]
          teamInfo: TeamInfo
          ['bot.Provider']: string
        }
      ) => {
        let addedMembers = ''

        await Promise.all(
          members.map(async (account) => {
            try {
              const user = await app.msgraph.getMemberProfile(
                account.aadObjectId
              )

              addedMembers += `${user.displayName} `

              await app.store.registerSpecialist({
                userGlobalId: account.aadObjectId,
                email: user.userPrincipalName,
                userName: user.displayName,
                physicalNumber: `+${app.carrier.cleanNumber(user.mobilePhone)}`
              })

              await app.store.registerOrUpdateTeam({
                teamId: teamInfo.id,
                teamName: teamInfo.name
              })

              await app.store.registerProviderSpecialist({
                'bot.Provider': botProvider,
                userLocalId: account.id,
                userGlobalId: account.aadObjectId
              })
            } catch (ex) {
              console.error(ex)
            }
          })
        )
        try {
          await context.response.send(
            HeroCard({
              title: 'Member added to team',
              text: `${addedMembers} added to ${teamInfo.name}.`
            })
          )
          console.log(`${addedMembers} added to ${teamInfo.name}.`)
        } catch (ex) {
          console.error(ex)
        }
      }
    )

    app.bot.command('urn:com.sync247:TeamAdded').api(
      async (
        context: IopaBotAdapterContext,
        {
          bot,
          teamInfo
        }: {
          bot: ChannelAccount
          teamInfo: { id: string; name: string; global_id: string }
        }
      ) => {
        let item: {
          userGlobalId: string
          ['bot.conversation']: any // JSON stringified,
          carrierProvider: CARRIER_PROVIDER
          virtualNumber: string
          physicalNumber: string
          userName: string
          userSurname: string
          userGivenName: string
          role: 'provisioned' | 'bot'
        }

        try {
          item = (
            await app.db.collection('temp').doc(teamInfo.name).get()
          ).data() as any
        } catch (ex) {
          console.error(ex)
        }

        await context.response.send(
          <card>
            <body>
              <text size="extraLarge">Welcome</text>
              <text>Welcome to the sync24-7 contact center</text>
              <factset>
                {item && (
                  <fact
                    title="Virtual"
                    value={app.carrier.beautifyNumber(item.virtualNumber)}
                  />
                )}
                {item && <fact title="Provider" value={item.carrierProvider} />}
                {item && (
                  <fact
                    title="Mobile"
                    value={app.carrier.beautifyNumber(item.physicalNumber)}
                  />
                )}
                {item && <fact title="Specialist" value={item.userName} />}
                {item && <fact title="Voicemail" value="default" />}
                <fact title="Env" value={process.env.NODE_ENV} />
              </factset>
            </body>
          </card>
        )

        try {
          const teamWithVirtualNumber = {
            teamId: teamInfo.id,
            teamGlobalId: teamInfo.global_id,
            teamName: teamInfo.name,
            userLocalId: bot.id,
            userGlobalId: item.userGlobalId,
            carrierProvider: item.carrierProvider,
            virtualNumber: item ? item.virtualNumber : null,
            physicalNumber: item ? item.physicalNumber : null,
            'bot.Source': context['bot.Source'],
            'bot.Provider': context['bot.Provider'],
            'bot.ServiceUrl': context['bot.ServiceUrl'],
            role: item.role,
            userName: item.userName,
            userGivenName: item.userGivenName,
            userSurname: item.userSurname
          } as TeamRecord

          await app.store.registerOrUpdateTeam(teamWithVirtualNumber)

          if (item) {
            await app.store.registerOrUpdateVirtualNumberTeam(
              teamWithVirtualNumber
            )

            console.log('Registered virtual number in store')

            if (process.env.MSTEAMS_OWNER_ID !== item.userGlobalId) {
              try {
                await app.msgraph.addMemberToTeam({
                  groupid: teamInfo.global_id,
                  uid: item.userGlobalId
                })
                console.log('Added member to team')
              } catch (ex) {
                console.error(ex)
                // silently log and continue
              }
            }

            try {
              if (
                process.env.MSTEAMS_OWNER_ID2 &&
                process.env.MSTEAMS_OWNER_ID2 !== item.userGlobalId
              ) {
                await app.msgraph.addOwnerToTeam({
                  groupid: teamInfo.global_id,
                  uid: process.env.MSTEAMS_OWNER_ID2
                })
                console.log('Added second owner to team')
              }
            } catch (ex) {
              console.error(ex)
              // silently log and continue
            }

            console.log('Add virtual number to specialist store')
            const specialist = await app.store.getSpecialist({
              userGlobalId: item.userGlobalId
            })
            await app.store.registerSpecialist({
              userGlobalId: item.userGlobalId,
              virtualNumber: item.virtualNumber,
              provisionedNumbers: (
                (specialist && specialist.provisionedNumbers) ||
                []
              )
                .concat(item.virtualNumber)
                .filter(onlyUnique)
            })

            // NOT CURRENTLY SUPPORTED USING APPLICATION PRIVILEGES (KNOWN MSGRAPH ISSUE)

            /*  try {
                                  await app.msgraph.updateTeamPhoto({
                                      groupid: teamInfo.global_id,
                                      photo: teamPhoto
                                  })
                                   console.log("Updated team profile photo")
                              } catch (ex) {
                                  console.error(ex)
                              } */

            await app.db.collection('temp').doc(teamInfo.name).delete()

            context.log(`Removed temp table`)

            await context['bot.Capability'].adapter.continueConversation(
              JSON.parse(item['bot.conversation']),
              async (origcontext) => {
                await origcontext.response.status(200).send(
                  TeamLinkCard({
                    title: 'Team created',
                    text:
                      'Team has been succesfully setup successfully created',
                    label: teamInfo.name,
                    'bot.Team': {
                      id: teamInfo.id,
                      globalid: teamInfo.global_id
                    },
                    tenant: process.env.MSAPP_TENANT
                  })
                )
              }
            )

            context.log(`Team created successfully`)
          }
        } catch (ex) {
          console.error(ex)
          console.error(JSON.stringify(ex.json && ex.json()))
        }
      }
    )

    app.bot
      .command('urn:com.sync247:TeamMembersRemoved')
      .api(
        async (
          context: IopaBotAdapterContext,
          {
            members,
            teamInfo
          }: { members: ChannelAccount[]; teamInfo: TeamInfo }
        ) => {
          const teamGlobalId =
            teamInfo.aadGroupId ||
            (await app.store.getTeam({ teamId: teamInfo.id })).teamGlobalId

          if (!teamGlobalId || teamGlobalId !== process.env.MSTEAMS_GROUP_ID) {
            return
          }

          console.log('urn:com.sync247:TeamMembersRemoved')

          let count = 0

          await Promise.all(
            members.map(async (account) => {
              try {
                const specialist = await app.store.getSpecialist({
                  userGlobalId: account.aadObjectId
                })

                if (!specialist) {
                  return
                }

                await Promise.all(
                  specialist.provisionedNumbers.map(async (virtualNumber) => {
                    try {
                      const teamRecord = await app.store.getVirtualNumberTeam({
                        virtualNumber
                      })

                      teamRecord.virtualNumber = virtualNumber

                      await context.response.send(
                        `Unprovisioning ${app.carrier.beautifyNumber(
                          virtualNumber
                        )} assigned to ${teamRecord.userName}`
                      )

                      await app.store.deleteTeam(teamRecord)

                      await app.teams.sendToExistingOrNewTeamsChannel(
                        {
                          provider: teamRecord['bot.Provider'],
                          groupId: teamRecord.teamGlobalId,
                          channelDescriptor: null /** General */,
                          channelName: 'General',
                          botId: teamRecord.userLocalId,
                          serviceUrl: teamRecord['bot.ServiceUrl'],
                          activity: MessageFactory.text(
                            'The virtual number associated with this account has been unprovisioned'
                          )
                        },
                        async (ctx) => {
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

                      count++
                    } catch (ex) {
                      console.error(ex)
                    }
                  })
                )
              } catch (ex) {
                console.error(ex)
              }
            })
          )

          await context.response.send(
            `${count} virtual numbers returned to pool.`
          )
          console.log(`${count} virtual numbers returned to pool.`)
        }
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
