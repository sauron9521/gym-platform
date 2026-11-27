import { PrismaPg } from '@prisma/adapter-pg';
import { measureRequestDatabaseCall } from '#src/common/request-context/request-database-timing';

/** Use the installed adapter's public queryable contract, not the global
 * Prisma query-event listener (which cannot establish request ownership).
 * Leave connection, transaction control, disposal and error behavior intact. */
export class RequestTimedPrismaPg extends PrismaPg {
  override async connect(): ReturnType<PrismaPg['connect']> {
    const adapter = await super.connect();
    const queryRaw = adapter.queryRaw.bind(adapter);
    const executeRaw = adapter.executeRaw.bind(adapter);
    const startTransaction = adapter.startTransaction.bind(adapter);
    adapter.queryRaw = (query) => measureRequestDatabaseCall(() => queryRaw(query));
    adapter.executeRaw = (query) => measureRequestDatabaseCall(() => executeRaw(query));
    adapter.startTransaction = async (isolation) => {
      const transaction = await startTransaction(isolation);
      const query = transaction.queryRaw.bind(transaction);
      const execute = transaction.executeRaw.bind(transaction);
      transaction.queryRaw = (value) => measureRequestDatabaseCall(() => query(value));
      transaction.executeRaw = (value) => measureRequestDatabaseCall(() => execute(value));
      return transaction;
    };
    return adapter;
  }
}
