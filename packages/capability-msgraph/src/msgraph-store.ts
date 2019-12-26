import * as MicrosoftGraph from '@microsoft/microsoft-graph-client'
import * as Graph from '@microsoft/microsoft-graph-types'
import { getToken, AuthToken } from './msgraph-auth'

/**
 * CI Step to interact with a Microsoft OneDrive store such as a Sharepoint folder
 * or Microsoft Teams channel documents folder
 */
export class MSGraphStore {
  private accessToken: AuthToken

  private client: MicrosoftGraph.Client

  /**
   * Provide token to this interactor for authorization
   *
   * @param accessToken MSGraph token for user with sufficient permissions
   */
  constructor() {
    try {
      this.client = MicrosoftGraph.Client.init({
        defaultVersion: 'v1.0',
        debugLogging: false,
        authProvider: this.authProvider
      })
    } catch (ex) {
      console.error(ex)
    }
  }

  public async getMemberProfile(uid: string): Promise<Graph.User> {
    return this.client.api(`/users/${uid}`).get()
  }

  public async updateMemberProfile({
    uid,
    ...user
  }: {
    uid: string
    businessPhones: string[]
  }): Promise<Graph.User> {
    return this.client.api(`/users/${uid}`).patch(user)
  }

  public async checkGroupOwner(uid: string): Promise<boolean> {
    try {
      const result: Graph.User = await this.client
        .api(
          `groups/${process.env.MSTEAMS_ADMIN_GROUP_ID}/members/${uid}?$select=id`
        )
        .get()
      if (!result) {
        return false
      }
      return result.id === uid
    } catch (ex) {
      console.error(ex)
      return false
    }
  }

  public async deleteTeam(groupId: string): Promise<void> {
    throw new Error('Unupported by Microsoft Teams API')

    /*   const response = await this.client
                .api(`teams/${groupId}`)
                .responseType(MicrosoftGraph.ResponseType.RAW)
                .delete()

            console.log(JSON.stringify(response, null, 2)) */
  }

  public async getTeamsInstalledAppDefinition(
    groupId: string
  ): Promise<
    | {
        id: string
        teamsAppDefinition: {
          id: string
          teamsAppId: string
          displayName: string
          version: string
          publishingState: string
        }
      }
    | {
        id: string
      }
  > {
    const result: {
      value: {
        id: string // "MjQ1NTViYmMtMmQ5Mi00N2UwLThhZjctNjc2NDJlNTViZmVkIyNhOWNiOTA1ZC1kOTYwLTQ3OTMtYmJkNy04MTk3OGY5NTgxMTM=",
        teamsAppDefinition: {
          id: string // "YTljYjkwNWQtZDk2MC00NzkzLWJiZDctODE5NzhmOTU4MTEzIyMxLjAuMA==",
          teamsAppId: string // MSTEAMS_APP_ID,
          displayName: string // "sync (d)",
          version: string // "1.0.0",
          publishingState: string // "published",
        }
      }[]
    } = await this.client
      .api(
        `teams/${groupId}/installedApps?$expand=teamsAppDefinition&$filter=teamsAppDefinition/teamsAppId eq '${process.env.MSTEAMS_APP_ID}'`
      )
      .get()

    if (result && result.value && result.value.length > 0) {
      return result.value[0]
    }
    return { id: null }
  }

  public async deleteThisAppFromTeam(groupId: string): Promise<void> {
    const { id } = await this.getTeamsInstalledAppDefinition(groupId)

    if (!id) {
      console.error('could not delete app from team')
      return
    }

    await this.client
      .api(`teams/${groupId}/installedApps/${id}`)
      .responseType(MicrosoftGraph.ResponseType.RAW)
      .delete()
  }

  public async addThisAppToTeam(groupId: string): Promise<void> {
    const teamsAppInstallation = {
      'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps('${process.env.MSTEAMS_APP_ID}')`
    }

    await this.client
      .api(`teams/${groupId}/installedApps`)
      .responseType(MicrosoftGraph.ResponseType.RAW)
      .post(teamsAppInstallation)
  }

  public async createTeam(
    {
      name,
      description
    }: {
      name: string
      description: string
    },
    progressCallback: (text: string) => Promise<void>
  ): Promise<void> {
    const teamObject = {
      'template@odata.bind':
        "https://graph.microsoft.com/beta/teamsTemplates('standard')",
      'owners@odata.bind': [
        `https://graph.microsoft.com/beta/users('${process.env.MSTEAMS_OWNER_ID}')`
      ],
      visibility: 'Private',
      displayName: name,
      description,
      memberSettings: {
        allowCreateUpdateChannels: true,
        allowDeleteChannels: true,
        allowAddRemoveApps: false,
        allowCreateUpdateRemoveTabs: true,
        allowCreateUpdateRemoveConnectors: true
      },
      guestSettings: {
        allowCreateUpdateChannels: true,
        allowDeleteChannels: true
      },
      funSettings: {
        allowGiphy: false,
        giphyContentRating: 'Moderate',
        allowStickersAndMemes: true,
        allowCustomMemes: true
      },
      messagingSettings: {
        allowUserEditMessages: true,
        allowUserDeleteMessages: true,
        allowOwnerDeleteMessages: true,
        allowTeamMentions: false,
        allowChannelMentions: false
      },
      discoverySettings: {
        showInTeamsSearchAndSuggestions: false
      },
      installedApps: [
        {
          'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps('${process.env.MSTEAMS_APP_ID}')`
        }
      ]
    }

    const response: any = await this.client
      .api(`teams`)
      .version('beta')
      .responseType(MicrosoftGraph.ResponseType.RAW)
      .post(teamObject)

    const location = response.headers.get('location')

    let counter = 0

    return new Promise((resolve, reject) => {
      const wait: () => NodeJS.Timeout = () =>
        setTimeout(async () => {
          const result = await this.client.api(location).get()

          await progressCallback(
            `${new Date().toLocaleTimeString()} ${result.status}`
          )

          if (result.status !== 'succeeded' && counter++ < 3) {
            wait()
          } else {
            resolve(null)
          }
        }, 5000)

      wait()
    })
  }

  public async updateTeam({
    groupId,
    name,
    description
  }: {
    groupId: string
    name: string
    description: string
  }): Promise<void> {
    const teamObject = {
      displayName: name,
      description
    }

    // Note: updating team in msgraph does not work for name/description must update group
    await this.client
      .api(`groups/${groupId}`)
      .responseType(MicrosoftGraph.ResponseType.RAW)
      .patch(teamObject)
  }

  public async addMemberToTeam({
    groupid,
    uid
  }: {
    groupid: string
    uid: string
  }): Promise<void> {
    const userObject = {
      '@odata.id': `https://graph.microsoft.com/beta/directoryObjects/${uid}`
    }

    await this.client
      .api(`groups/${groupid}/members/$ref`)
      .version('beta')
      .post(userObject)
  }

  public async addOwnerToTeam({
    groupid,
    uid
  }: {
    groupid: string
    uid: string
  }): Promise<void> {
    const userObject = {
      '@odata.id': `https://graph.microsoft.com/beta/directoryObjects/${uid}`
    }

    await this.client
      .api(`groups/${groupid}/owners/$ref`)
      .version('beta')
      .post(userObject)
  }

  public async getTeamByDisplayName({
    displayName
  }: {
    displayName: string
  }): Promise<
    {
      id: string
      createdDateTime: string
      createdByAppId: string
      description: string
      displayName: string
      visibility: string
    }[]
  > {
    const responses = await this.client
      .api(`groups`)
      .version('beta')
      .filter(
        `resourceProvisioningOptions/Any(x:x eq 'Team') and startswith(displayName, '${displayName}')`
      )
      .get()

    return responses.value as {
      /** group id e.g., "79968cd9-e534-413a-8633-ce580310c842" */
      id: string
      /** date and time the team was created "2020-06-08T13:48:42Z" */
      createdDateTime: string
      /** app that created the team "cc15fd57-2c6c-4117-a88c-83b1d56b4bbe" */
      createdByAppId: string
      /** description e.g., "Provisioned Sync24-7 environment for Karla Sync, Virtual Well-Being Coach" */
      description: string
      /** displayName e.g., "sync 1 (222) 222-2222 Surname-staging" */
      displayName: string
      /** visibility public or private */
      visibility: string
    }[]
  }

  public async getChannelByDescription({
    groupid,
    description
  }: {
    groupid: string
    description: string
  }): Promise<
    {
      id: string
      displayName: string
      description: string
      isFavoriteByDefault: boolean
      email: string
      webUrl: string
      membershipType: 'standard' | 'private'
    }[]
  > {
    const responses = await this.client
      .api(`teams/${groupid}/channels`)
      .version('beta')
      .filter(`description eq '${description}'`)
      .get()

    return responses.value as {
      /** local id of the channel e.g.,  "19:ba2b702a58374e89a30f493a77a9b2b2@thread.skype" */
      id: string
      /** displayname of the channel, initally set to virtual number without +, but can be user changed */
      displayName: string
      /** description of the channel, always set to virtual number without + eg., 16152416286 */
      description: string
      /** not reliably updated or read by MS Graph currently */
      isFavoriteByDefault: boolean
      /** not used */
      email: string
      /** not used and not the serviceUrl */
      webUrl: string
      /** visibility of the channel */
      membershipType: 'standard' | 'private'
    }[]
  }

  public async getChannelGeneral({
    groupid
  }: {
    groupid: string
  }): Promise<
    {
      id: string
      displayName: string
      description: string
      isFavoriteByDefault: boolean
      email: string
      webUrl: string
      membershipType: 'standard' | 'private'
    }[]
  > {
    const responses = await this.client
      .api(`teams/${groupid}/channels`)
      .version('beta')
      .filter(`displayName eq 'General'`)
      .get()

    return responses.value as {
      /** local id of the channel e.g.,  "19:ba2b702a58374e89a30f493a77a9b2b2@thread.skype" */
      id: string
      /** displayname of the channel, initally set to virtual number without +, but can be user changed */
      displayName: string
      /** description of the channel, always set to virtual number without + eg., 16152416286 */
      description: string
      /** not reliably updated or read by MS Graph currently */
      isFavoriteByDefault: boolean
      /** not used */
      email: string
      /** not used and not the serviceUrl */
      webUrl: string
      /** visibility of the channel */
      membershipType: 'standard' | 'private'
    }[]
  }

  public async getChannel({
    groupid,
    channelid
  }: {
    groupid: string
    channelid: string
  }): Promise<{
    id: string
    displayName: string
    description: string
    isFavoriteByDefault: boolean
    email: string
    webUrl: string
    membershipType: 'standard' | 'private'
  }> {
    const response = await this.client
      .api(`teams/${groupid}/channels/${channelid}`)
      .version('beta')
      .get()

    return response as {
      /** local id of the channel e.g.,  "19:ba2b702a58374e89a30f493a77a9b2b2@thread.skype" */
      id: string
      /** displayname of the channel, initally set to virtual number without +, but can be user changed */
      displayName: string
      /** description of the channel, always set to virtual number without + eg., 16152416286 */
      description: string
      /** not reliably updated or read by MS Graph currently */
      isFavoriteByDefault: boolean
      /** not used */
      email: string
      /** not used and not the serviceUrl */
      webUrl: string
      /** visibility of the channel */
      membershipType: 'standard' | 'private'
    }
  }

  public async createChannel({
    groupid,
    displayName,
    description
  }: {
    groupid: string
    displayName: string
    description: string
  }): Promise<any> {
    return this.client.api(`teams/${groupid}/channels`).version('beta').post({
      displayName,
      description,
      isFavoriteByDefault: true,
      membershipType: 'standard'
    })
  }

  // NOT CURRENTLY SUPPORTED USING APPLICATION PRIVILEGES (KNOWN MSGRAPH ISSUE)
  public async updateTeamPhoto({
    groupid,
    photo
  }: {
    groupid: string
    photo: string
  }): Promise<void> {
    await this.client
      .api(`teams/${groupid}/photo`)
      .version('beta')
      .header('content-type', 'image/jpeg')
      .put(photo)
  }

  /**
   * Helper callback that simulates a msal AuthProvider and just returns the stored token
   * Called by the msgraph runtime
   */
  private authProvider: MicrosoftGraph.AuthProvider = async (
    callback: MicrosoftGraph.AuthProviderCallback
  ) => {
    if (!this.accessToken) {
      await this.refreshToken()
    }

    callback(null, this.accessToken.access_token)
  }

  private async refreshToken(): Promise<void> {
    this.accessToken = await getToken()

    if (this.accessToken.expires_in > 60) {
      setTimeout(() => {
        this.accessToken = null
      }, (this.accessToken.expires_in - 60) * 1000)
    } else {
      console.log('ACCESS TOKEN EXPIRES IN LESS THAN 1 MINUTE')
    }
  }
}

export default MSGraphStore
