import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Single source of truth for which Firestore database the functions target.
// Emulator → '(default)', everything else → 'kulasharingapp'.
// Deliberately gated ONLY on FUNCTIONS_EMULATOR (set by the emulator runtime
// itself): a stray NODE_ENV=development in a deploy shell must never silently
// bind triggers to the wrong database.
export function getDatabaseId(): string {
  return process.env.FUNCTIONS_EMULATOR === 'true' ? '(default)' : 'kulasharingapp';
}

export function getDb() {
  return getFirestore(getDatabaseId());
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
