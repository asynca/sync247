/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards'

export const ReactiveCardsFix = ReactiveCards // required for certain build packagers

export function VoiceMailCard({
  text,
  recordingUrl,
  fromNumber,
  toNumber,
  callerId,
  callbackPayload
}: {
  text: string
  fromNumber: string
  toNumber: string
  callerId: string
  recordingUrl: string
  callbackPayload: any
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        <text size="small" color="accent" weight="lighter">
          VOICEMAIL {fromNumber} {callerId}
        </text>
        <text size="large">Inbound Voicemail</text>
        <text>{text}</text>
      </body>
      <actionset>
        <action type="openurl" url={recordingUrl}>
          Source
        </action>
        <action type="submit" data={callbackPayload}>
          Call back
        </action>
      </actionset>
    </card>
  )
}

export function CallRecordCard({
  title,
  duration,
  participantNumber,
  callerId,
  status,
  callbackPayload
}: {
  title: string
  participantNumber: string
  status?: string
  duration: string
  callerId?: string
  callbackPayload: any
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        <text size="small" color="accent" weight="lighter">
          VOICE {participantNumber} {callerId || status} DURATION {duration}s
        </text>
        <text size="large">{title}</text>
      </body>
      <actionset>
        <action type="submit" data={callbackPayload}>
          Call back
        </action>
      </actionset>
    </card>
  )
}
