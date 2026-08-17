import mysql from "mysql2/promise";

function getConfig() {
  if (process.env.DATABASE_URL) {
    const parsed = new URL(process.env.DATABASE_URL);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
    };
  }
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "english_app",
  };
}

const db = await mysql.createConnection(getConfig());
const [stats] = await db.query(`
  SELECT vocab_source,
    COUNT(*) c,
    SUM(image_url LIKE '%dicebear%') dicebear,
    SUM(image_url LIKE '%unsplash%') unsplash,
    SUM(image_url LIKE '%wikimedia%') wiki,
    SUM(image_url LIKE '%picsum%') picsum
  FROM vocabulary GROUP BY vocab_source`);
console.table(stats);
const [sample] = await db.query(`SELECT word, image_url, vocab_source FROM vocabulary WHERE LOWER(word)='apple'`);
console.log(sample);
await db.end();
