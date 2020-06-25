import { Activity } from 'iopa-botadapter'
import { IopaBotAdapterContext } from 'iopa-botadapter-types'

export interface TeamsStoreMethods {
  sendToExistingOrNewTeamsChannel(
    options: {
      provider: string
      groupId: string
      channelDescriptor: string
      channelName: string
      botId: string
      serviceUrl: string
      activity: Activity
    },
    logic: (context: IopaBotAdapterContext) => Promise<void>
  ): Promise<void>
}

export type TeamsStore = TeamsStoreMethods
