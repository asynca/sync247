/* eslint-disable no-await-in-loop */
import { Sync247Store } from '@sync247/capability-sync247-store'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { TeamsStore } from '@sync247/capability-teams'
import { EdgeApp } from '@iopa-edge/types'
import { IopaBotAdapterContext } from 'iopa-botadapter'
import { BotCommand } from 'iopa-botcommander'
import { Carrier, CARRIER_PROVIDER } from 'iopa-carrier'
import provisionNumber from './provisionNumber'

export default async function provisionAreaCode(
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
    locality: string
    provider: CARRIER_PROVIDER
  }
): Promise<void> {
  const { member, virtualnumber: areacode, provider, locality } = data

  const availablenumbers = await app.carrier.getAvailablePhoneNumbers(
    provider,
    areacode,
    locality
  )

  if (
    !availablenumbers ||
    availablenumbers.available_phone_numbers.length === 0
  ) {
    await context.response.send(`No numbers available in areacode ${areacode}`)
    return
  }

  let tries = 0
  let virtualnumber

  do {
    virtualnumber = availablenumbers.available_phone_numbers[tries].phone_number

    try {
      const result = await app.carrier.purchaseIncomingPhoneNumber(
        provider,
        virtualnumber
      )

      if (result) {
        await provisionNumber(app, context, {
          member,
          virtualnumber: result.phone_number,
          provider
        })
        return
      }
    } catch (ex) {
      console.error(ex)
    }

    virtualnumber = null
    tries++
  } while (
    tries < 3 &&
    tries < availablenumbers.available_phone_numbers.length - 1
  )

  if (!virtualnumber) {
    await context.response.send(
      `Could not purchase an available number, please try provisioning directly in the carrier console`
    )
  }
}
