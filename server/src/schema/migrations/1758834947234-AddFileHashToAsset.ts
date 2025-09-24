import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('asset')
    .addColumn('fileHash', 'bytea')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('asset')
    .dropColumn('fileHash')
    .execute();
}

