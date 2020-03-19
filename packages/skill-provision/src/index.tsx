/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards' // required for certain build packagers

import { BotCommand } from 'iopa-botcommander'
import { IopaBotAdapterContext, CardFactory } from 'iopa-botadapter'
import { EdgeApp } from '@iopa-edge/types'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store } from '@sync247/capability-sync247-store'
import { TeamsStore } from '@sync247/capability-teams'
import { Carrier } from 'iopa-carrier-types'

import provisionAreaCode from './provisionAreaCode'
import provisionNumber from './provisionNumber'
import { setVoicemail, showVoicemail } from './voicemail'
import reassignNumber from './reassignNumber'
import migrateNumber from './migrateNumber'
import unprovision from './unprovision'

export const ReactiveCardsFix = ReactiveCards

export default class {
  app: EdgeApp & {
    bot: BotCommand
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  constructor(
    app: EdgeApp & {
      bot: BotCommand
      msgraph: MSGraphStore
      store: Sync247Store
      carrier: Carrier
      teams: TeamsStore
    }
  ) {
    this.app = app

    app.bot
      .command('voicemail <virtualnumber> [text]')
      .action(async (context: IopaBotAdapterContext, data) => {
        if (
          data.text &&
          !(await app.msgraph.checkGroupOwner(context['bot.From'].id))
        ) {
          const card = CardFactory.heroCard(
            'Provision Error',
            `Sorry, you have to be an administrator to be able to change a voicemail greeting`
          )

          await context.response.send(card)
          return
        }
        const virtualNumber = this.app.carrier.cleanNumber(data.virtualnumber)

        const voicemailText = data.text
          ? (data.raw as string).split(' ').splice(2).join(' ')
          : undefined

        if (
          !isNumeric(virtualNumber) ||
          virtualNumber.length < 8 ||
          virtualNumber.length > 15
        ) {
          await context.response.send(
            'The first argument for the voicemail command must be a valid telephone number'
          )
          return
        }

        if (voicemailText) {
          await setVoicemail(app, context, {
            virtualNumber,
            voicemailText
          })
        } else {
          await showVoicemail(app, context, {
            virtualNumber
          })
        }
      })

    app.bot
      .command('unprovision <virtualnumber>')
      .action(async (context: IopaBotAdapterContext, data) => {
        try {
          if (!(await app.msgraph.checkGroupOwner(context['bot.From'].id))) {
            const card = CardFactory.heroCard(
              'Provision Error',
              `Sorry, you have to be an administrator to be able to provision resources;  code: ${context['bot.From'].id}`
            )

            await context.response.send(card)
            return
          }
        } catch (ex) {
          console.log(ex)

          await context.response.send(ex.message)
          return
        }

        const virtualnumber = this.app.carrier.cleanNumber(data.virtualnumber)

        if (
          !isNumeric(virtualnumber) ||
          virtualnumber.length < 8 ||
          virtualnumber.length > 15
        ) {
          await context.response.send(
            'The sole argument for the unprovision command must be a valid telephone number'
          )
          return
        }

        await unprovision(this.app, context, virtualnumber)
      })

    app.bot
      .command('migrate <virtualnumber>')
      .action(async (context: IopaBotAdapterContext, data) => {
        try {
          if (!(await app.msgraph.checkGroupOwner(context['bot.From'].id))) {
            const card = CardFactory.heroCard(
              'Provision Error',
              `Sorry, you have to be an administrator to be able to change provisioning;  code: ${context['bot.From'].id}`
            )

            await context.response.send(card)
            return
          }
        } catch (ex) {
          console.log(ex)

          await context.response.send(ex.message)
          return
        }

        const virtualnumber = this.app.carrier.cleanNumber(data.virtualnumber)

        if (
          !isNumeric(virtualnumber) ||
          virtualnumber.length < 8 ||
          virtualnumber.length > 15
        ) {
          await context.response.send(
            'The sole argument for the unprovision command must be a valid telephone number'
          )
          return
        }

        await migrateNumber(this.app, context, virtualnumber)
      })

    app.bot
      .command('provision <member> <virtualnumber>')
      .option('-p --provider <name>', 'twilio or signalwire', 'twilio')
      .option(
        '-l --locality <city>',
        'restrict to city when virtual number is an area code'
      )
      .action(async (context: IopaBotAdapterContext, data) => {
        if (!(await app.msgraph.checkGroupOwner(context['bot.From'].id))) {
          const card = CardFactory.heroCard(
            'Provision Error',
            `Sorry, you have to be an administrator to be able to provision resources`
          )

          await context.response.send(card)
          return
        }

        const { virtualnumber, locality } = data

        if (virtualnumber.length === 3) {
          await provisionAreaCode(this.app, context, data)
          return
        }
        if (locality) {
          await context.response.send(
            'Locality option can only be specified with 3 digit area US codes'
          )
          return
        }
        await provisionNumber(app, context, data)
      })

    app.bot
      .command('assign <member> <virtualnumber>')
      .action(async (context: IopaBotAdapterContext, data) => {
        if (!(await app.msgraph.checkGroupOwner(context['bot.From'].id))) {
          const card = CardFactory.heroCard(
            'Provision Error',
            `Sorry, you have to be an administrator to be able to provision and reassign resources`
          )

          await context.response.send(card)
          return
        }

        const { member } = data

        const virtualnumber = this.app.carrier.cleanNumber(data.virtualnumber)

        if (
          !isNumeric(virtualnumber) ||
          virtualnumber.length < 8 ||
          virtualnumber.length > 15
        ) {
          await context.response.send(
            'The second argument for the assign command must be a valid telephone number'
          )
          return
        }

        await reassignNumber(this.app, context, {
          member,
          virtualnumber
        })
      })
  }
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value)
}
