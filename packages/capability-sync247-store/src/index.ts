import { EdgeApp, IopaEdgeStore } from '@iopa-edge/types'
import { TeamRecord, UserStore, Sync247Store } from './types'

export { TeamRecord, UserStore, Sync247Store }

export default class Sync247StoreCapability implements Sync247Store {
  private db: IopaEdgeStore

  constructor(app: EdgeApp & { store: Sync247Store }) {
    this.db = app.db
    app.store = this
  }

  async registerSpecialist({
    userGlobalId,
    ...user
  }: Partial<UserStore>): Promise<void> {
    await this.db
      .collection('specialists')
      .doc(userGlobalId)
      .set(user, { merge: true })
  }

  async getSpecialist({
    userGlobalId
  }: Partial<UserStore>): Promise<UserStore> {
    return (
      await this.db.collection('specialists').doc(userGlobalId).get()
    ).data() as UserStore
  }

  async registerOrUpdateTeam({
    teamId,
    ...team
  }: Partial<TeamRecord>): Promise<void> {
    await this.db.collection('teams').doc(teamId).set(team, { merge: true })
  }

  async getTeam({ teamId }: Partial<TeamRecord>): Promise<TeamRecord> {
    return (
      await this.db.collection('teams').doc(teamId).get()
    ).data() as TeamRecord
  }

  async registerOrUpdateVirtualNumberTeam({
    virtualNumber,
    ...team
  }: Partial<TeamRecord>): Promise<void> {
    await this.db
      .collection('virtualnumbers')
      .doc(virtualNumber)
      .set(team, { merge: true })
  }

  async getVirtualNumberTeam({
    virtualNumber
  }: Partial<TeamRecord>): Promise<TeamRecord> {
    return (
      await this.db.collection('virtualnumbers').doc(virtualNumber).get()
    ).data() as TeamRecord
  }

  async deleteTeam({
    virtualNumber,
    teamId,
    userGlobalId
  }: Partial<TeamRecord>): Promise<void> {
    try {
      await this.db.collection('virtualnumbers').doc(virtualNumber).delete()
    } catch (ex) {
      console.log(ex)
    }

    try {
      await this.db.collection('teams').doc(teamId).delete()
    } catch (ex) {
      console.log(ex)
    }

    try {
      const specialist = (
        await this.db.collection('specialists').doc(userGlobalId).get()
      ).data() as Partial<UserStore>

      if (specialist.virtualNumber === virtualNumber) {
        delete specialist.virtualNumber

        await this.db
          .collection('specialists')
          .doc(userGlobalId)
          .set(specialist, { merge: false })
      }
    } catch (ex) {
      console.log(ex)
    }
  }

  async registerProviderSpecialist({
    'bot.Provider': botProvider,
    userLocalId,
    userGlobalId
  }: Partial<TeamRecord>): Promise<void> {
    await this.db
      .collection('providers')
      .doc(botProvider)
      .collection('specialists')
      .doc(userLocalId)
      .set(
        {
          userGlobalId
        },
        { merge: true }
      )
  }

  async getProviderSpecialist({
    'bot.Provider': botProvider,
    userLocalId
  }: Partial<TeamRecord>): Promise<Partial<TeamRecord>> {
    return (
      await this.db
        .collection('providers')
        .doc(botProvider)
        .collection('specialists')
        .doc(userLocalId)
        .get()
    ).data() as Partial<TeamRecord>
  }
}
