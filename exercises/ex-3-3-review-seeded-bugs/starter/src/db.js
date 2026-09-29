import { DatabaseSync } from "node:sqlite";

/** Opens an in-memory SQLite database with the orders table and five sample rows. */
export function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      user_email TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      refunded_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
  const insert = db.prepare("INSERT INTO orders (user_email, total_cents) VALUES (?, ?)");
  insert.run("alice@example.com", 10000);
  insert.run("bob@example.com", 2500);
  insert.run("alice@example.com", 4000);
  insert.run("carol@example.com", 999);
  insert.run("dave@example.com", 15000);
  return db;
}
