/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards' // required for certain build packagers

import { BotAdapterApp, MessageFactory, CardFactory } from 'iopa-botadapter'
import { MSGraphStore } from '@sync247/capability-msgraph'
import { Sync247Store, TeamRecord } from '@sync247/capability-sync247-store'
import { TeamsStore } from '@sync247/capability-teams'
import {
  Carrier,
  IopaCarrierContext,
  CARRIER_PROVIDER
} from 'iopa-carrier-types'
import { VoiceMailCard, CallRecordCard } from '@sync247/common-cards'

export const ReactiveCardsFix = ReactiveCards

const BEEP_MP3 = 'https://firebasestorage.googleapis.com/v0/b/karla-media.appspot.com/o/assets%2Fbeepbutton.mp3?alt=media&token=98fee557-d4ec-47c8-8e76-bd3aff1e4913'.replace(
  /&/g,
  '&amp;'
)

export default class {
  app: BotAdapterApp & {
    msgraph: MSGraphStore
    store: Sync247Store
    carrier: Carrier
    teams: TeamsStore
  }

  constructor(
    app: BotAdapterApp & {
      msgraph: MSGraphStore
      store: Sync247Store
      carrier: Carrier
      teams: TeamsStore
    }
  ) {
    this.app = app

    if (!app.carrier) {
      console.error(app)
      throw new Error('App is missing carrier')
    }

    app.carrier.onCall(
      async (
        context: IopaCarrierContext,
        next: () => Promise<void>
      ): Promise<void> => {
        if (
          context['bot.Capability'].activity.channelData.Direction ===
          'outbound-api'
        ) {
          return next()
        }

        const subtype = context['iopa.Url'].searchParams.get('subtype')

        switch (subtype) {
          case 'whisper':
            return this.onWhisperCall(context, next)
          case 'whispered':
            return this.onWhisperComplete(context, next)
          case 'callcomplete':
            return this.onCallComplete(context, next)
          case 'callbackoption':
            return this.onCallBackOption(context, next)
          case 'transcription':
            return this.onTranscription(context, next)
          case 'recordingcomplete':
            return this.onRecordingComplete(context, next)
          default:
            return this.onIncomingCall(context, next)
        }
      }
    )

    app.carrier.onCallStatus(
      async (
        context: IopaCarrierContext,
        next: () => Promise<void>
      ): Promise<void> => {
        if (
          context['bot.Capability'].activity.channelData.Direction ===
          'outbound-api'
        ) {
          return onCallStatusOutbound(context, next)
        }

        if (
          context['bot.Capability'].activity.channelData.CallStatus ===
          'completed'
        ) {
          const virtualNumber = context['bot.Recipient'].localid
          const recipientNumber = context['bot.From'].localid

          const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam(
            { virtualNumber: context['bot.Recipient'].localid }
          )
          if (!teamRecord) {
            return next()
          }

          console.log(
            `Call Complete ${context['bot.From'].localid} to ${JSON.stringify(
              teamRecord.physicalNumber
            )}`
          )

          const { channelData } = context['bot.Capability'].activity
          const duration = channelData.CallDuration
          const title = duration < 61 ? 'Missed Inbound Call' : 'Inbound Call'
          const callerId = context['bot.From'].name

          const card = CallRecordCard({
            participantNumber: context['bot.Capability'].carrier.beautifyNumber(
              recipientNumber
            ),
            title,
            duration,
            callerId,
            callbackPayload: {
              'bot.Intent': 'urn:io.iopa.bot:intent:literal',
              'bot.Text': 'urn:com.sync247:carrier:clicktocall',
              'bot.Provider': context['bot.Provider'],
              physicalNumber: teamRecord.physicalNumber,
              virtualNumber,
              'bot.Recipient': recipientNumber
            }
          })

          await this.app.teams.sendToExistingOrNewTeamsChannel(
            {
              provider: teamRecord['bot.Provider'],
              groupId: teamRecord.teamGlobalId,
              channelName: this.app.carrier
                .beautifyNumber(recipientNumber)
                .replace(/^\+/, ''),
              channelDescriptor: recipientNumber.replace(/^\+/, ''),
              botId: teamRecord.userLocalId,
              serviceUrl: teamRecord['bot.ServiceUrl'],
              activity: MessageFactory.attachment(
                CardFactory.reactiveCard(card)
              )
            },
            () => Promise.resolve()
          )
        }

        return next()
      }
    )

    const onCallStatusOutbound = async (
      context: IopaCarrierContext,
      next: () => Promise<void>
    ): Promise<void> => {
      const status = context['bot.Capability'].activity.channelData.CallStatus

      const physicalNumber = context['bot.Recipient'].localid
      const virtualNumber = context['bot.From'].localid
      const recipientNumber = `+${context['iopa.Url'].searchParams.get(
        'recipient'
      )}`

      const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
        virtualNumber
      })

      if (!teamRecord) {
        return next()
      }

      console.log(
        `Outbound Call Complete ${physicalNumber} to ${recipientNumber}`
      )

      const { channelData } = context['bot.Capability'].activity
      const duration = channelData.CallDuration
      const title = duration < 61 ? 'Outbound Call Attempt' : 'Outbound Call'

      const card = CallRecordCard({
        participantNumber: context['bot.Capability'].carrier.beautifyNumber(
          recipientNumber
        ),
        title,
        duration,
        status,
        callbackPayload: {
          'bot.Intent': 'urn:io.iopa.bot:intent:literal',
          'bot.Text': 'urn:com.sync247:carrier:clicktocall',
          'bot.Provider': context['bot.Provider'],
          physicalNumber,
          virtualNumber,
          'bot.Recipient': recipientNumber
        }
      })

      await this.app.teams.sendToExistingOrNewTeamsChannel(
        {
          provider: teamRecord['bot.Provider'],
          groupId: teamRecord.teamGlobalId,
          channelDescriptor: recipientNumber.replace(/^\+/, ''),
          channelName: this.app.carrier
            .beautifyNumber(recipientNumber)
            .replace(/^\+/, ''),
          botId: teamRecord.userLocalId,
          serviceUrl: teamRecord['bot.ServiceUrl'],
          activity: MessageFactory.attachment(CardFactory.reactiveCard(card))
        },
        () => Promise.resolve()
      )

      return next()
    }

    app.botadapter.onActionInvoke(
      async (
        context,
        value: {
          ['bot.Intent']: 'urn:io.iopa.bot:intent:literal'
          ['bot.Text']: string
          ['bot.Provider']: CARRIER_PROVIDER
          physicalNumber: string
          virtualNumber: string
          ['bot.Recipient']: string
        },
        next
      ) => {
        if (
          value['bot.Intent'] === 'urn:io.iopa.bot:intent:literal' &&
          value['bot.Text'] === 'urn:com.sync247:carrier:clicktocall'
        ) {
          await context.response.send('Ok, connecting')

          await app.carrier.clickToCall({
            provider: value['bot.Provider'],
            baseUrl: app.carrier.getBaseUrl(context),
            physicalNumber: value.physicalNumber,
            virtualNumber: value.virtualNumber,
            recipientNumber: value['bot.Recipient']
          })
        }

        return next()
      }
    )
  }

  async onIncomingCall(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
      virtualNumber: context['bot.Recipient'].localid
    })

    if (!teamRecord) {
      console.error(
        new Error(
          `[skill-voice-to-voice.onIncomingCall] could you find virtual number ${context['bot.Recipient'].localid}`
        )
      )
      return next()
    }

    console.log(
      `Transferring voice call from ${
        context['bot.From'].localid
      } to ${JSON.stringify(teamRecord.physicalNumber)}`
    )

    const whisperCallUrl = getSubTypeUrl(context, 'whisper')
    const callCompleteUrl = getSubTypeUrl(context, 'callcomplete')

    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Dial answerOnBridge="true" action="${callCompleteUrl}" timeout="12">
        <Number url="${whisperCallUrl}">${teamRecord.physicalNumber}</Number>
        </Dial>
    </Response>`,
      { status: 200 }
    )
    return next()
  }

  async onWhisperCall(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    console.log(`Whisper call from ${context['bot.From'].localid}`)
    const whisperCompleteUrl = getSubTypeUrl(context, 'whispered')

    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Gather action="${whisperCompleteUrl}" timeout="5" numDigits="1"><Say voice="alice" language="en-GB"> Press 1 to accept call from Sync Health, any other key to reject</Say></Gather>
              <Hangup />
            </Response>`,
      { status: 200 }
    )
    return next()
  }

  async onWhisperComplete(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const digits = context['bot.Capability'].activity.channelData.Digits
    console.log(
      `Whisper disposition ${JSON.stringify(digits)} ${
        context['bot.From'].localid
      }`
    )

    if (digits === '1') {
      void context.response.end(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200 }
      )
      return next()
    }
    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Hangup/>
      </Response>
   `,
      { status: 200 }
    )
    return next()
  }

  async onCallComplete(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const { activity } = context['bot.Capability']

    if (
      activity.channelData.DialCallStatus === 'completed' ||
      activity.channelData.DialCallStatus === 'answered'
    ) {
      void context.response.end(
        `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
               <Play>${BEEP_MP3}</Play>
              <Hangup />
            </Response>`,
        { status: 200 }
      )
      return next()
    }

    console.log(
      `Gathering callback options for missed call from ${context['bot.From'].localid}`
    )
    const callBackOptionUrl = getSubTypeUrl(context, 'callbackoption')

    const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
      virtualNumber: context['bot.Recipient'].localid
    })

    let voiceMailText

    if (!teamRecord) {
      console.error(
        new Error(
          `[skill-voice-to-voice.onIncomingCall] could not find virtual number ${context['bot.Recipient'].localid}`
        )
      )
    } else {
      voiceMailText = teamRecord.voicemailText
    }

    voiceMailText =
      voiceMailText ||
      `Thank you for calling Sync Health.   If you need emergency assistance, please hang up and dial nine one one immediately.  If you aren’t in an emergency, please press 1 and one of our associates will return a call to the number you called from. Or press any other key or remain on the line to leave a message. One of our associates will return your call or voicemail at our soonest opportunity, within one business day.  Thank you again for calling, we look forward to speaking with you soon.
 `

    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Gather action="${callBackOptionUrl}" actionOnEmptyResult="true" timeout="10" numDigits="1">
          <Say voice="alice" language="en-GB">${voiceMailText}</Say>
          </Gather>
        </Response>
     `,
      { status: 200 }
    )

    return next()
  }

  async onCallBackOption(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const digits = context['bot.Capability'].activity.channelData.Digits

    console.log(
      `Callback disposition ${JSON.stringify(digits)} ${
        context['bot.From'].localid
      }`
    )

    const transcriptionUrl = getSubTypeUrl(context, 'transcription')
    const recordingCompleteUrl = getSubTypeUrl(context, 'recordingcomplete')

    if (digits === '1') {
      void context.response.end(
        `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Play>${BEEP_MP3}</Play>
            <Say voice="alice" language="en-GB"> Ok, we'll call you back on this number.</Say>
            <Hangup />
          </Response>`,
        { status: 200 }
      )

      const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
        virtualNumber: context['bot.Recipient'].localid
      })

      await this.app.teams.sendToExistingOrNewTeamsChannel(
        {
          provider: teamRecord['bot.Provider'],
          groupId: teamRecord.teamGlobalId,
          channelDescriptor: context['bot.From'].localid.replace(/^\+/, ''),
          channelName: this.app.carrier
            .beautifyNumber(context['bot.From'].localid)
            .replace(/^\+/, ''),
          botId: teamRecord.userLocalId,
          serviceUrl: teamRecord['bot.ServiceUrl'],
          activity: MessageFactory.text(
            `Call back requested from ${this.app.carrier
              .beautifyNumber(context['bot.From'].localid)
              .replace(/^\+/, '')}`
          )
        },
        () => Promise.resolve()
      )

      return next()
    }
    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-GB">Please leave a message after the beep and press pound when you're done.</Say>
        <Record action="${recordingCompleteUrl}" finishOnKey="#" transcribe="true" transcribeCallback="${transcriptionUrl}" />
        <Hangup />
      </Response>
   `,
      { status: 200 }
    )
    return next()
  }

  async onRecordingComplete(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
      virtualNumber: context['bot.Recipient'].localid
    })
    console.log(
      `Recording complete ${context['bot.From'].localid} to ${JSON.stringify(
        teamRecord.physicalNumber
      )}`
    )

    void context.response.end(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-GB">Thanks, your message has been sent.</Say>
        <Play>${BEEP_MP3}</Play>
        <Hangup />
      </Response>
   `,
      { status: 200 }
    )

    await this.app.teams.sendToExistingOrNewTeamsChannel(
      {
        provider: teamRecord['bot.Provider'],
        groupId: teamRecord.teamGlobalId,
        channelDescriptor: context['bot.From'].localid.replace(/^\+/, ''),
        channelName: this.app.carrier
          .beautifyNumber(context['bot.From'].localid)
          .replace(/^\+/, ''),
        botId: teamRecord.userLocalId,
        serviceUrl: teamRecord['bot.ServiceUrl'],
        activity: MessageFactory.text(
          `Processing voice mail from ${this.app.carrier
            .beautifyNumber(context['bot.From'].localid)
            .replace(/^\+/, '')}`
        )
      },
      () => Promise.resolve()
    )

    return next()
  }

  async onTranscription(
    context: IopaCarrierContext,
    next: () => Promise<void>
  ): Promise<void> {
    const virtualNumber = context['bot.Recipient'].localid
    const fromNumber = context['bot.From'].localid
    const teamRecord: TeamRecord = await this.app.store.getVirtualNumberTeam({
      virtualNumber
    })
    console.log(
      `Transcribe ${fromNumber} to ${JSON.stringify(teamRecord.physicalNumber)}`
    )

    const { channelData } = context['bot.Capability'].activity

    if (channelData.TranscriptionText || channelData.RecordingUrl) {
      let recordingUrl: string
      if (channelData.RecordingUrl.startsWith('/')) {
        recordingUrl = await this.app.carrier.getRecordingUrl(
          context['bot.Provider'],
          channelData.RecordingUrl
        )
      } else {
        recordingUrl = channelData.RecordingUrl
      }

      const activity = MessageFactory.attachment(
        CardFactory.reactiveCard(
          VoiceMailCard({
            text: channelData.TranscriptionText || 'no transcription available',
            fromNumber: this.app.carrier.beautifyNumber(fromNumber),
            toNumber: this.app.carrier.beautifyNumber(virtualNumber),
            callerId: context['bot.From'].name,
            recordingUrl,
            callbackPayload: {
              'bot.Intent': 'urn:io.iopa.bot:intent:literal',
              'bot.Text': 'urn:com.sync247:carrier:clicktocall',
              'bot.Provider': context['bot.Provider'],
              physicalNumber: teamRecord.physicalNumber,
              virtualNumber,
              'bot.Recipient': fromNumber
            }
          })
        )
      )

      await this.app.teams.sendToExistingOrNewTeamsChannel(
        {
          provider: teamRecord['bot.Provider'],
          groupId: teamRecord.teamGlobalId,
          channelDescriptor: fromNumber.replace(/^\+/, ''),
          channelName: this.app.carrier
            .beautifyNumber(fromNumber)
            .replace(/^\+/, ''),
          botId: teamRecord.userLocalId,
          serviceUrl: teamRecord['bot.ServiceUrl'],
          activity
        },
        () => Promise.resolve()
      )
    } else {
      console.log('no transcription available')
      /* noop -- handled in callstatus handler */
    }

    void context.response.end()
    return next()
  }
}

function getSubTypeUrl(context: IopaCarrierContext, subtype: string): string {
  const provider = context['bot.Provider']
  const type = context['iopa.Url'].searchParams.get('type')
  const callback_token = encodeURIComponent(
    context['iopa.Url'].searchParams.get('callback_token')
  )

  return `${context['iopa.Url'].protocol}//${context['iopa.Url'].hostname}${context['iopa.Path']}?provider=${provider}&amp;type=${type}&amp;callback_token=${callback_token}&amp;subtype=${subtype}`
}
