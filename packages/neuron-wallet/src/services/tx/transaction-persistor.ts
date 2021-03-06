import { getConnection } from 'typeorm'
import { OutPoint, Transaction, TransactionWithoutHash, Input, TransactionStatus } from 'types/cell-types'
import InputEntity from 'database/chain/entities/input'
import OutputEntity from 'database/chain/entities/output'
import TransactionEntity from 'database/chain/entities/transaction'
import LockUtils from 'models/lock-utils'
import { OutputStatus, TxSaveType } from './params'

/* eslint @typescript-eslint/no-unused-vars: "warn" */
/* eslint no-await-in-loop: "off" */
/* eslint no-restricted-syntax: "off" */
export class TransactionPersistor {
  // After the tx is sent:
  // 1. If the tx is not persisted before sending, output = sent, input = pending
  // 2. If the tx is already persisted before sending, do nothing
  public static saveWithSent = async (transaction: Transaction): Promise<TransactionEntity> => {
    const txEntity: TransactionEntity | undefined = await getConnection()
      .getRepository(TransactionEntity)
      .findOne(transaction.hash)

    if (txEntity) {
      // nothing to do if exists already
      return txEntity
    }
    return TransactionPersistor.create(transaction, OutputStatus.Sent, OutputStatus.Pending)
  }

  // After the tx is fetched:
  // 1. If the tx is not persisted before fetching, output = live, input = dead
  // 2. If the tx is already persisted before fetching, output = live, input = dead
  public static saveWithFetch = async (transaction: Transaction): Promise<TransactionEntity> => {
    const connection = getConnection()
    const txEntity: TransactionEntity | undefined = await connection
      .getRepository(TransactionEntity)
      .findOne(transaction.hash, { relations: ['inputs', 'outputs'] })

    // return if success
    if (txEntity && txEntity.status === TransactionStatus.Success) {
      return txEntity
    }

    if (txEntity) {
      // input -> previousOutput => dead
      // output => live
      const outputs: OutputEntity[] = await Promise.all(
        txEntity.outputs.map(async o => {
          const output = o
          output.status = OutputStatus.Live
          return output
        })
      )

      const previousOutputsWithUndefined: Array<OutputEntity | undefined> = await Promise.all(
        txEntity.inputs.map(async input => {
          const outPoint: OutPoint = input.previousOutput()
          const { cell } = outPoint

          if (cell) {
            const outputEntity: OutputEntity | undefined = await connection.getRepository(OutputEntity).findOne({
              outPointTxHash: cell.txHash,
              outPointIndex: cell.index,
            })
            if (outputEntity) {
              outputEntity.status = OutputStatus.Dead
            }
            return outputEntity
          }
          return undefined
        })
      )

      const previousOutputs: OutputEntity[] = previousOutputsWithUndefined.filter(o => !!o) as OutputEntity[]

      // should update timestamp / blockNumber / blockHash / status
      txEntity.timestamp = transaction.timestamp
      txEntity.blockHash = transaction.blockHash
      txEntity.blockNumber = transaction.blockNumber
      txEntity.status = TransactionStatus.Success
      await connection.manager.save([txEntity, ...outputs.concat(previousOutputs)])

      return txEntity
    }

    return TransactionPersistor.create(transaction, OutputStatus.Live, OutputStatus.Dead)
  }

  // only create, check exist before this
  public static create = async (
    transaction: Transaction,
    outputStatus: OutputStatus,
    inputStatus: OutputStatus
  ): Promise<TransactionEntity> => {
    const connection = getConnection()
    const tx = new TransactionEntity()
    tx.hash = transaction.hash
    tx.version = transaction.version
    tx.deps = transaction.deps!
    tx.timestamp = transaction.timestamp!
    tx.blockHash = transaction.blockHash!
    tx.blockNumber = transaction.blockNumber!
    tx.witnesses = transaction.witnesses!
    tx.description = transaction.description
    // update tx status here
    tx.status = outputStatus === OutputStatus.Sent ? TransactionStatus.Pending : TransactionStatus.Success
    tx.inputs = []
    tx.outputs = []
    const inputs: InputEntity[] = []
    const previousOutputs: OutputEntity[] = []
    for (const i of transaction.inputs!) {
      const input = new InputEntity()
      const { cell } = i.previousOutput
      if (cell) {
        input.outPointTxHash = cell.txHash
        input.outPointIndex = cell.index
      }
      input.transaction = tx
      input.capacity = i.capacity || null
      input.lockHash = i.lockHash || null
      input.since = i.since!
      inputs.push(input)

      if (cell) {
        const previousOutput: OutputEntity | undefined = await connection.getRepository(OutputEntity).findOne({
          outPointTxHash: input.previousOutput().cell!.txHash,
          outPointIndex: input.previousOutput().cell!.index,
        })

        if (previousOutput) {
          // update previousOutput status here
          previousOutput.status = inputStatus
          previousOutputs.push(previousOutput)
        }
      }
    }

    const outputs: OutputEntity[] = await Promise.all(
      transaction.outputs!.map(async (o, index) => {
        const output = new OutputEntity()
        output.outPointTxHash = transaction.hash
        output.outPointIndex = index.toString()
        output.capacity = o.capacity
        output.lock = o.lock
        output.lockHash = o.lockHash!
        output.transaction = tx
        output.status = outputStatus
        return output
      })
    )

    await connection.manager.save([tx, ...inputs, ...previousOutputs, ...outputs])
    return tx
  }

  public static deleteWhenFork = async (blockNumber: string) => {
    const txs = await getConnection()
      .getRepository(TransactionEntity)
      .createQueryBuilder('tx')
      .where(
        'CAST(tx.blockNumber AS UNSIGNED BIG INT) > CAST(:blockNumber AS UNSIGNED BIG INT) AND tx.status = :status',
        {
          blockNumber,
          status: TransactionStatus.Success,
        }
      )
      .getMany()
    return getConnection().manager.remove(txs)
  }

  // update previousOutput's status to 'dead' if found
  // calculate output lockHash, input lockHash and capacity
  // when send a transaction, use TxSaveType.Sent
  // when fetch a transaction, use TxSaveType.Fetch
  public static convertTransactionAndSave = async (
    transaction: Transaction,
    saveType: TxSaveType
  ): Promise<TransactionEntity> => {
    const tx: Transaction = transaction
    tx.outputs = tx.outputs!.map(o => {
      const output = o
      output.lockHash = LockUtils.lockScriptToHash(output.lock!)
      return output
    })

    tx.inputs = await Promise.all(
      tx.inputs!.map(async i => {
        const input: Input = i
        const { cell } = i.previousOutput

        if (cell) {
          const outputEntity: OutputEntity | undefined = await getConnection()
            .getRepository(OutputEntity)
            .findOne({
              outPointTxHash: cell.txHash,
              outPointIndex: cell.index,
            })
          if (outputEntity) {
            input.capacity = outputEntity.capacity
            input.lockHash = outputEntity.lockHash
          }
        }
        return input
      })
    )
    let txEntity: TransactionEntity
    if (saveType === TxSaveType.Sent) {
      txEntity = await TransactionPersistor.saveWithSent(transaction)
    } else if (saveType === TxSaveType.Fetch) {
      txEntity = await TransactionPersistor.saveWithFetch(transaction)
    } else {
      throw new Error('Error TxSaveType!')
    }
    return txEntity
  }

  public static saveFetchTx = async (transaction: Transaction): Promise<TransactionEntity> => {
    const txEntity: TransactionEntity = await TransactionPersistor.convertTransactionAndSave(
      transaction,
      TxSaveType.Fetch
    )
    return txEntity
  }

  public static saveSentTx = async (
    transaction: TransactionWithoutHash,
    txHash: string
  ): Promise<TransactionEntity> => {
    const tx: Transaction = {
      hash: txHash,
      ...transaction,
    }
    const txEntity: TransactionEntity = await TransactionPersistor.convertTransactionAndSave(tx, TxSaveType.Sent)
    return txEntity
  }
}

export default TransactionPersistor
