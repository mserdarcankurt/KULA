import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export function getDb() {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const isDevMode = isEmulator || process.env.NODE_ENV === 'development';
  const databaseId = isDevMode ? '(default)' : 'kulasharingapp';
  return getFirestore(databaseId);
}

export class BatchManager {
  private db = getDb();
  private batch = this.db.batch();
  private count = 0;

  async set(ref: admin.firestore.DocumentReference, data: any, options?: admin.firestore.SetOptions) {
    if (options) {
      this.batch.set(ref, data, options);
    } else {
      this.batch.set(ref, data);
    }
    this.count++;
    if (this.count >= 400) await this.commit();
  }

  async update(ref: admin.firestore.DocumentReference, data: any) {
    this.batch.update(ref, data);
    this.count++;
    if (this.count >= 400) await this.commit();
  }

  async delete(ref: admin.firestore.DocumentReference) {
    this.batch.delete(ref);
    this.count++;
    if (this.count >= 400) await this.commit();
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = this.db.batch();
      this.count = 0;
    }
  }
}
