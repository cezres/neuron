import React, { useCallback } from 'react'
import { Route, RouteComponentProps } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Stack, Pivot, PivotItem, IconButton, Text } from 'office-ui-fabric-react'

import { StateWithDispatch } from 'states/stateProvider/reducer'

import GeneralSetting from 'components/GeneralSetting'
import Wallets from 'components/WalletSetting'
import NetworkSetting from 'components/NetworkSetting'
import { WalletWizardPath } from 'components/WalletWizard'

import { Routes } from 'utils/const'

const pivotItems = [
  { label: 'settings.setting-tabs.general', url: Routes.SettingsGeneral },
  { label: 'settings.setting-tabs.wallets', url: Routes.SettingsWallets },
  { label: 'settings.setting-tabs.network', url: Routes.SettingsNetworks },
]

const settingPanels: CustomRouter.Route[] = [
  {
    name: `GeneralSetting`,
    path: Routes.SettingsGeneral,
    exact: false,
    comp: GeneralSetting,
  },
  {
    name: `WalletsSetting`,
    path: Routes.SettingsWallets,
    exact: false,
    comp: Wallets,
  },
  {
    name: `NetworkSetting`,
    path: Routes.SettingsNetworks,
    exact: true,
    comp: NetworkSetting,
  },
]

const Settings = ({
  location,
  history,
  dispatch,
  ...neuronWalletState
}: React.PropsWithoutRef<StateWithDispatch & RouteComponentProps>) => {
  const [t] = useTranslation()
  const { id } = neuronWalletState.wallet
  const onLeave = useCallback(() => {
    return id ? history.push(Routes.Overview) : history.push(`${Routes.WalletWizard}${WalletWizardPath.Welcome}`)
  }, [id, history])

  return (
    <Stack tokens={{ childrenGap: 15 }}>
      <Stack horizontal>
        <Stack.Item align="center">
          <IconButton
            iconProps={{ iconName: 'Leave' }}
            onClick={onLeave}
            styles={{ root: { marginRight: 20 }, flexContainer: { display: 'block', width: '32px' } }}
          />
        </Stack.Item>
        <Stack.Item align="center">
          <Text variant="xLarge" as="h1">
            {t('navbar.settings')}
          </Text>
        </Stack.Item>
      </Stack>

      <Pivot
        selectedKey={location.pathname}
        onLinkClick={(pivotItem?: PivotItem) => {
          if (pivotItem && pivotItem.props && pivotItem.props.itemKey) {
            history.replace(pivotItem.props.itemKey)
          }
        }}
        headersOnly
      >
        {pivotItems.map(pivotItem => (
          <PivotItem key={pivotItem.url} headerText={t(pivotItem.label)} itemKey={pivotItem.url} />
        ))}
      </Pivot>

      {settingPanels.map(container => (
        <Route
          exact={container.exact}
          path={`${container.path}${container.params || ''}`}
          key={container.name}
          render={routerProps => {
            return <container.comp {...neuronWalletState} {...routerProps} dispatch={dispatch} />
          }}
        />
      ))}
    </Stack>
  )
}

Settings.displayName = 'Settings'

export default Settings
