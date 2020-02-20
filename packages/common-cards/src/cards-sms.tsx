/** @jsx ReactiveCards.h */
import * as ReactiveCards from 'reactive-cards'

export const ReactiveCardsFix = ReactiveCards // required for certain build packagers

export function SmsCard({
  caption,
  text
}: {
  text: string
  caption: string
}): ReturnType<ReactiveCards.createElement> {
  return (
    <card>
      <body>
        <text size="small" color="accent" weight="lighter">
          {caption}
        </text>
        {text && <text wrap>{text}</text>}
      </body>
    </card>
  )
}
