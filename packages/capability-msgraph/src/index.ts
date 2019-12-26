import { App } from 'iopa'

import { MSGraphStore } from './msgraph-store'

export { MSGraphStore }

// note: do not export testing-framework as msw distorts response in cloudlfare environment

export default class MicrosoftGraphCapability {
  constructor(app: App & { msgraph: MSGraphStore }) {
    app.msgraph = new MSGraphStore()
  }
}
