const sql = require('mssql');
const mcache = require('memory-cache');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'DBHive',
  server: 'vip.hivesql.io',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const runQuery = async (query) => {
  try {
    // Create a connection pool
    const pool = await sql.connect(dbConfig);

    // Execute the provided query
    const result = await pool.request().query(query);

    // Send the query result as JSON response
    return result.recordset;
  } catch (error) {
    console.error('Error executing query:', error.message);
    return { error: 'An error occurred while executing the query.' };
  } finally {
    // Close the connection pool
    sql.close();
  }
}

// API endpoint to execute Hive SQL query independent of the frontend
const getQuery = async (req, res) => {  
  const { query } = req.body;

  // check if query is cached
  const cachedBody = mcache.get(query);

  if (cachedBody) {
    const result = JSON.parse(cachedBody)
    return res.json(result);
  }

  // run query
  const result = await runQuery(query);

  // cache result for an hour if no error
  if (!result.error)
    mcache.put(query, JSON.stringify(result), 3600 * 1000);

  // if error, return error
  if (result.error) {
    return res.status(400).json(result);
  }

  // return result
  return res.json(result);
};

module.exports = getQuery;