import mysql from "mysql2/promise";

function getPoolConfig() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasDiscreteConfig =
    Boolean(process.env.DB_HOST) &&
    Boolean(process.env.DB_USER) &&
    Boolean(process.env.DB_NAME);

  const allowLocalFallback = process.env.NODE_ENV !== "production";

  if (!hasDatabaseUrl && !hasDiscreteConfig && !allowLocalFallback) {
    throw new Error(
      "Missing DB config. Set DATABASE_URL or DB_HOST + DB_USER + DB_NAME."
    );
  }

  const basePoolOptions = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    queueLimit: 0,
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  };

  if (hasDatabaseUrl) {
    const parsed = new URL(process.env.DATABASE_URL);
    return {
      ...basePoolOptions,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
    };
  }

  /** Laragon/XAMPP: user `apptienganh_` chưa tạo → dùng root + DB_NAME (mật khẩu thường rỗng). Chỉ development. */
  const useDefaultLocal =
    process.env.NODE_ENV !== "production" &&
    String(process.env.DB_USE_DEFAULT_LOCAL || "").toLowerCase() === "true";

  if (useDefaultLocal) {
    return {
      ...basePoolOptions,
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME || "english_app",
    };
  }

  if (!hasDiscreteConfig && allowLocalFallback) {
    return {
      ...basePoolOptions,
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
      database: "english_app",
    };
  }

  return {
    ...basePoolOptions,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  };
}

let poolInstance;

function createPool() {
  if (process.env.NODE_ENV === "production") {
    return mysql.createPool(getPoolConfig());
  }

  if (!global._mysqlPool) {
    global._mysqlPool = mysql.createPool(getPoolConfig());
  }
  return global._mysqlPool;
}

export function getPool() {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

const pool = {
  query(...args) {
    return getPool().query(...args);
  },
  execute(...args) {
    return getPool().execute(...args);
  },
  getConnection(...args) {
    return getPool().getConnection(...args);
  },
};

export default pool;
