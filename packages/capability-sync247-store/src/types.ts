import { CARRIER_PROVIDER } from 'iopa-carrier-types'

export interface TeamRecord {
  /**  The team or organizational identifier (e.g., Slack team) */
  teamId: string
  /**  The global unique identifier of the group associated with this team (e.g., AAD) */
  teamGlobalId: string
  /**  The team name */
  teamName: string
  /** The global id of the user */
  userGlobalId: string
  /** The display name of the user */
  userName: string
  /** The preferred (first) name of the user */
  userGivenName: string
  /** The display name of the user */
  userSurname: string
  /** The local id of the bot (within the domain of the source platform)  */
  userLocalId: string
  /** The timestamp of the last update */
  // eslint-disable-next-line @rushstack/no-new-null
  updated?: number | null
  /** The carrier provider twilio or signalwire */
  carrierProvider: CARRIER_PROVIDER
  /** The virtual mobile number of the team */
  virtualNumber: string
  /** The physical mobile number associated with this team */
  physicalNumber: string
  /** The platform provider within the source platform e.g., "msteams" */
  ['bot.Provider']: string
  /** The endpoint associated with the provider (e.g., botframework channel serviceurl) */
  ['bot.ServiceUrl']: string
  /** The urn of the conversational agent service provider e.g., "urn:io.iopa.bot:slack", "urn:io.iopa.bot:alexa" */
  ['bot.Source']: string
  /** The bot conversation reference of the last update for this team/virtual number */
  conversationReference: string // JSON stringified
  /** Thee role of this team within Sync247 */
  role: 'provisioned' | 'helpdesk' | 'other'
  /**  The voicemail script to use for this number */
  voicemailText?: string
}

export interface UserStore {
  /** The global id of the specialist or participant */
  userGlobalId: string
  /** The display name of the user */
  userName: string
  /** The preferred (first) name of the user */
  userGivenName: string
  /** The display name of the user */
  userSurname: string
  /** The virtual email of the user */
  email?: string
  /** The physical mobile number of the user */
  physicalNumber?: string
  /** The virtual mobile number of the user */
  virtualNumber?: string
  /** All the provisioned virtual mobile numbers of the user */
  provisionedNumbers?: string[]
}

export interface Sync247Store {
  registerSpecialist({
    userGlobalId,
    ...user
  }: Partial<UserStore>): Promise<void>
  getSpecialist({ userGlobalId }: Partial<UserStore>): Promise<UserStore>
  registerOrUpdateTeam({ teamId, ...team }: Partial<TeamRecord>): Promise<void>
  getTeam({ teamId }: Partial<TeamRecord>): Promise<TeamRecord>
  registerOrUpdateVirtualNumberTeam({
    virtualNumber,
    ...team
  }: Partial<TeamRecord>): Promise<void>
  getVirtualNumberTeam({
    virtualNumber
  }: Partial<TeamRecord>): Promise<TeamRecord>
  deleteTeam({
    virtualNumber,
    teamId,
    userGlobalId
  }: Partial<TeamRecord>): Promise<void>
  registerProviderSpecialist(params: Partial<TeamRecord>): Promise<void>
  getProviderSpecialist(
    params: Partial<TeamRecord>
  ): Promise<Partial<TeamRecord>>
}
