/** Minimal SQLite surface shared by expo-sqlite and the in-memory test double. */
export type SqlValue = string | number | null | boolean;

export interface LocalDb {
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
}
