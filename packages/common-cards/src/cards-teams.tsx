/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards'

export const ReactiveCardsFix = ReactiveCards // required for certain build packagers

export function TeamChannelLinkCard({
  title,
  text,
  label,
  'bot.Team': botTeam,
  'bot.Channel': botChannel,
  tenant
}: {
  title?: string
  text?: string
  label: string
  ['bot.Team']: { id?: string; globalid?: string }
  ['bot.Channel']: { id: string; name?: string }
  tenant: string
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        {title && <text size="large">{title}</text>}
        {text && <text wrap>{text}</text>}
      </body>
      <actionset>
        <action
          type="openurl"
          url={`https://teams.microsoft.com/l/channel/${botChannel.id}/${botChannel.name}?groupId=${botTeam.globalid}&tenantId=${tenant}`}
        >
          {label}
        </action>
      </actionset>
    </card>
  )
}

export function TeamLinkCard({
  title,
  text,
  label,
  'bot.Team': botTeam,
  tenant
}: {
  title?: string
  text?: string
  label: string
  ['bot.Team']: { id?: string; globalid?: string }
  tenant: string
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        {title && <text size="large">{title}</text>}
        {text && <text wrap>{text}</text>}
      </body>
      <actionset>
        <action
          type="openurl"
          url={`https://teams.microsoft.com/l/team/${botTeam.id}/conversations?groupId=${botTeam.globalid}&tenantId=${tenant}`}
        >
          {label}
        </action>
      </actionset>
    </card>
  )
}

export function HeroCard({
  title,
  text
}: {
  title: string
  text: string
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        <text size="large">{title}</text>
        <text wrap>{text}</text>
      </body>
    </card>
  )
}
