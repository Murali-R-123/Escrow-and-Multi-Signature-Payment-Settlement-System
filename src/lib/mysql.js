import mysql from 'mysql2/promise';

function createPool() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,       // DATETIME comes back as 'YYYY-MM-DD HH:MM:SS' (UTC, see below)
    decimalNumbers: true,    // DECIMAL comes back as JS numbers
  });
  // Run everything in UTC so NOW() in procedures and deadlines from the app agree.
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return pool;
}

// one pool per server process (survives Next.js hot reload in dev)
export function getPool() {
  if (!globalThis.__escrowMysqlPool) globalThis.__escrowMysqlPool = createPool();
  return globalThis.__escrowMysqlPool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Call a stored procedure and return the rows of its (first) result set. */
export async function callProc(name, args = []) {
  if (!/^sp_[a-z_]+$/.test(name)) throw new Error('invalid procedure name');
  const placeholders = args.map(() => '?').join(', ');
  const [res] = await getPool().query(`CALL ${name}(${placeholders})`, args);
  return Array.isArray(res) && Array.isArray(res[0]) ? res[0] : [];
}

/** JS Date | ISO string  ->  'YYYY-MM-DD HH:MM:SS' (UTC) for MySQL DATETIME */
export function toMysqlDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
