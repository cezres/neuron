import React from 'react'
import { storiesOf } from '@storybook/react'
import { withKnobs, boolean } from '@storybook/addon-knobs'
import GeneralSetting from 'components/GeneralSetting'
import initStates from 'states/initStates'

const states: { [title: string]: boolean } = {
  'Show address book on': true,
  'Show address book off': false,
}

const stories = storiesOf('GeneralSettings', module)

Object.entries(states).forEach(([title, showAddressBook]) => {
  const props = { ...initStates, settings: { ...initStates.settings, showAddressBook }, dispatch: () => {} }
  stories.add(title, () => <GeneralSetting {...props} />)
})

stories.addDecorator(withKnobs).add('With knobs', () => {
  const props = {
    ...initStates,
    settings: {
      ...initStates.settings,
      showAddressBook: boolean('Show Address Book', false),
    },
  }
  return <GeneralSetting {...props} dispatch={() => {}} />
})
