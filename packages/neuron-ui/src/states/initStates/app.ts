import { CapacityUnit } from 'utils/const'

const appState: State.App = {
  tipBlockNumber: '',
  chain: '',
  difficulty: '',
  epoch: '',
  send: {
    txID: '',
    outputs: [
      {
        address: '',
        amount: '',
        unit: CapacityUnit.CKB,
      },
    ],
    price: '0',
    cycles: '0',
    description: '',
    loading: false,
  },
  passwordRequest: {
    actionType: null,
    walletID: '',
    password: '',
  },
  messages: {
    networks: null,
    send: null,
    transaction: null,
    transactions: null,
    wizard: null,
  },
  popups: [],
  notifications: [],
  loadings: {
    sending: false,
    addressList: false,
    transactionList: false,
    updateDescription: false,
  },
  showTopAlert: false,
  showAllNotifications: false,
}

export default appState
