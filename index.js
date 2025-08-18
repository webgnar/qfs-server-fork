require("dotenv").config();

// Check required environment variables
const requiredEnvVars = ['AUTH_KEY', 'POSTING_KEY', 'ACCOUNT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('Warning: Missing environment variables:', missingVars);
  console.warn('Server will start but some features may not work properly');
} else {
  console.log('All required environment variables are present');
}
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dhive = require('@hiveio/dhive');
const path = require('path');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get } = require("firebase/database");
const logger = require('morgan');
const fs = require('fs');

// sql endpoint
const getQuery = require('./hivesql/main');

// Initialize Firebase with error handling
let db;
try {
  console.log('Initializing Firebase...');
  
  let app;
  
  // Check if we have service account credentials
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Using Firebase service account credentials');
    const admin = require('firebase-admin');
    
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://qfs-server-default-rtdb.firebaseio.com'
    });
    
    db = admin.database();
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    console.log('Using client Firebase configuration');
    const config = require('./firebase.json');
    app = initializeApp(config);
    db = getDatabase(app);
    console.log('Firebase client SDK initialized successfully');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Don't crash the server, just log the error
}

const client = new dhive.Client(['https://api.hive.blog', 'https://api.hivekings.com', 'https://anyx.io', 'https://api.openhive.network']);

const app = express();

const whitelist = [
  'https://dev.skatehive.app', 
  'https://www.skatehive.app', 
  'https://www.stoken.quest',
  'http://localhost:3000',
  'http://localhost:3002',  // Your Next.js frontend
  'https://qfs-frontend.vercel.app',  // Production frontend
  // Add additional domains as needed
  // 'https://your-custom-domain.com'
];

// allow cors for only the whitelist or if the environment is development
app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS check - origin:", origin);

    // Allow requests with no origin (like Postman, curl, direct browser access)
    if (!origin) {
      console.log("No origin - allowing request");
      return callback(null, true);
    }

    // Allow development environment
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode - allowing request");
      return callback(null, true);
    }

    // Check whitelist
    if (whitelist.includes(origin)) {
      console.log("Origin in whitelist - allowing request");
      return callback(null, true);
    }

    console.log("Origin not allowed:", origin);
    return callback(new Error('Not allowed by CORS'), false);
  }
}));

app.use(express.json());

app.enable('trust proxy');

// force https
app.use((request, response, next) => {

  if (process.env.NODE_ENV != 'development' && !request.secure) {
    return response.redirect("https://" + request.headers.host + request.url);
  }

  next();
});

// stop logging the http requests
app.use(logger('dev'));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`📥 Incoming request: ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Simple health check endpoint
app.get('/', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'OK', 
      message: 'QFS Server is running',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 3000,
      env: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add a basic health endpoint as well
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Very simple test endpoint
app.get('/test', (req, res) => {
  res.status(200).send('OK');
});

// Debug endpoint to show all environment info
app.get('/debug', (req, res) => {
  const config = require('./firebase.json');
  res.status(200).json({
    port: port,
    env_port: process.env.PORT,
    node_env: process.env.NODE_ENV,
    firebase_initialized: !!db,
    firebase_config: {
      projectId: config.projectId,
      databaseURL: config.databaseURL,
      authDomain: config.authDomain
    },
    timestamp: new Date().toISOString()
  });
});

// Simple test routes that don't require database
app.get('/api/test', (req, res) => {
  res.json({ message: 'API test endpoint working', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({ 
    status: 'online',
    server: 'QFS Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mock endpoints for testing while Firebase is being fixed
app.get('/leaderboard/mock', (req, res) => {
  res.json([
    { username: 'player1', highscore: 1000, timestamp: Date.now() },
    { username: 'player2', highscore: 850, timestamp: Date.now() },
    { username: 'player3', highscore: 750, timestamp: Date.now() }
  ]);
});

app.get('/times/mock', (req, res) => {
  res.json([
    { username: 'speedster1', time: 45, timestamp: Date.now() },
    { username: 'speedster2', time: 52, timestamp: Date.now() },
    { username: 'speedster3', time: 58, timestamp: Date.now() }
  ]);
});

// Firebase connection test
app.get('/firebase/test', async (req, res) => {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Try to connect to a simple path with timeout
    const testRef = ref(db, '.info/connected');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase connection timeout')), 5000)
    );
    
    console.log('🔥 Attempting to read .info/connected...');
    const snapshot = await Promise.race([get(testRef), timeoutPromise]);
    
    console.log('🔥 Firebase connection test result:', snapshot.val());
    res.json({ 
      firebase_connected: snapshot.val(),
      database_url: 'qfs-server-default-rtdb.firebaseio.com',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🔥 Firebase test error:', error.message);
    res.status(500).json({ 
      error: 'Firebase connection failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// /token/:username get request that returns a encoded jwt token with username, expires in 7 days
// encoded by posting key and has to be decoded by the username's public active key
app.get('/token/:username', async (req, res) => {
  const { username } = req.params;

  console.log(`🔑 Token request for username: ${username}`);

  // if the username doesn't exist then return 400
  if (!username) {
    console.log('❌ No username provided');
    return res.status(400).send('Bad request');
  }

  try {
    // encode the token with the AUTH_KEY
    const token = jwt.sign({ username }, process.env.AUTH_KEY, { expiresIn: '20d' });

    console.log(`🔑 Looking up Hive account: ${username}`);
    // encode the token with the username's public posting key
    const account = await client.database.getAccounts([username]);

    console.log(`🔑 Hive API response:`, account.length > 0 ? `Found account` : `No account found`);

    // if the account doesn't exist then return 404
    if (account.length === 0) {
      console.log(`❌ User not found: ${username}`);
      return res.status(404).send('User not found');
    }

    const publicKey = account[0].posting.key_auths[0][0];
    console.log(`🔑 Got public key for ${username}`);

    // hive memo encoding
    const encoded = dhive.Memo.encode(process.env.POSTING_KEY, publicKey, '#' + token);

    console.log(`✅ Token generated successfully for ${username}`);
    // send the encoded token as JSON
    res.status(200).json({
      success: true,
      encoded_message: encoded,
      username: username,
      message: "Please sign this message with your Hive account"
    });
  } catch (error) {
    console.error(`❌ Token generation error for ${username}:`, error);
    res.status(500).json({ error: 'Token generation failed', details: error.message });
  }
});

app.get('/token/external/:username', async (req, res) => {

  // request must be from valid origin or environment is development
  if (!whitelist.includes(req.headers.origin) && process.env.NODE_ENV != 'development') {
    return res.status(400).send('Bad request');
  }

  const { username } = req.params;

  // if the username doesn't exist then return 400
  if (!username) {
    return res.status(400).send('Bad request');
  }

  // encode the token with the AUTH_KEY
  const token = jwt.sign({ username }, process.env.AUTH_KEY, { expiresIn: '1d' });

  // return the token
  res.status(200).send(token);
});


// /verify post request that decodes the token and returns the user
app.post('/verify', async (req, res) => {
  console.log('🔐 Verify request received');
  
  // get token from authorization header
  const auth = req.headers.authorization;

  if (!auth) {
    console.log('❌ No authorization header');
    return res.status(400).send('Bad request');
  }

  console.log('🔐 Authorization header received:', auth.substring(0, 20) + '...');

  // slice the "Bearer " part from the token
  const token = auth.slice(7);

  // if the token doesn't exist then return 400
  if (!token) {
    console.log('❌ No token after slicing Bearer');
    return res.status(400).send('Bad request');
  }

  console.log('🔐 Token extracted, length:', token.length);

  // decode the token
  try {
    const decoded = jwt.verify(token, process.env.AUTH_KEY);

    // if the token is invalid then return 401
    if (!decoded) {
      console.log('❌ Token decoded but empty');
      return res.status(401).send('Unauthorized');
    }

    console.log('✅ Token verified successfully for user:', decoded.username);
    // send the decoded token
    res.status(200).send(decoded);
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    // if the token is invalid then return 401
    res.status(401).send('Unauthorized');
  }
});

// /pushscore post request gets playtime and highscore and stores it in the db along with timestamp
app.post('/pushscore', async (req, res) => {
  let auth;

  // create new custom token if the request is from the whitelist
  if (!req.headers.authorization
    && (whitelist.includes(req.headers.origin) || process.env.NODE_ENV === 'development' || !req.headers.origin)
    && req.body.username) {
    const reqUsername = req.body.username;

    // create a new token with the username
    const token = jwt.sign({ username: reqUsername }, process.env.AUTH_KEY, { expiresIn: '1d' });

    auth = 'Bearer ' + token;
  } else {
    // check authorization header
    auth = req.headers.authorization;
  }

  if (!auth) {
    return res.status(400).send('Bad request');
  }

  // slice the "Bearer " part from the token
  const token = auth.slice(7);

  // if the token doesn't exist then return 400
  if (!token) {
    return res.status(400).send('Bad request');
  }

  let username;

  // decode the token
  try {
    const decoded = jwt.verify(token, process.env.AUTH_KEY);

    // if the token is invalid then return 401
    if (!decoded) {
      return res.status(401).send('Unauthorized');
    }

    username = decoded.username;
  } catch (err) {
    // if the token is invalid then return 401
    res.status(401).send('Unauthorized');
  }

  const { highscore, time } = req.body;

  console.log(username, highscore, time);

  if (!username) {
    return res.status(400).send('Bad request');
  }

  const timestamp = new Date().getTime();
  const data = {
    username,
    highscore: highscore ? parseFloat(highscore) : 0,
    timestamp
  };
  const data_time = {
    username,
    time: time ? parseInt(time) : 0,
    timestamp
  };

  // if username has any invalid characters for firebase (., #, $, [, ], /) remove them
  let usernameOld = username;
  username = username.replace(/[.,#$\[\]\/]/g, '');

  // get the user from the database
  const userRef = ref(db, 'users/' + username);
  const timeRef = ref(db, 'times/' + username);
  const userSnap = await get(userRef);
  const timeSnap = await get(timeRef);

  // if the user exists then update the highscore and time
  if (highscore > 0) {
    if (userSnap.exists()) {
      const user = userSnap.val();
      user.highscore = highscore ? parseFloat(highscore) : user.highscore;
      user.timestamp = parseInt(timestamp);
    
      await set(userRef, user);
    } else {
      // else push the data to the database
      await set(userRef, data);
    }
  }

  if (time > 0) {
    if (timeSnap.exists()) {
      const user = timeSnap.val();
      user.time = time ? time : user.time;
      user.timestamp = timestamp;
  
      await set(timeRef, user);
    } else {
      // else push the data to the database
      await set(timeRef, data_time);
    }
  }

  // send 200 with the data
  res.status(200).send({
    username: usernameOld,
    highscore: highscore ? highscore : 0,
    time: time ? time : 0,
    timestamp
  });
});

// /leaderboard get request that returns the top 15 data from the db sorted by highscore in descending order
app.get('/leaderboard', async (req, res) => {
  try {
    console.log('📊 Leaderboard request received');
    
    if (!db) {
      console.error('❌ Database not initialized');
      return res.status(500).json({ error: 'Database not available' });
    }

    // get the data from the database with timeout
    console.log('📊 Fetching from Firebase users table...');
    
    // Add shorter timeout to prevent stack overflow
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase timeout')), 5000)
    );
    
    // TEMPORARILY DISABLE Firebase read due to corruption
    console.log('🚨 Firebase users table temporarily disabled due to corruption');
    return res.status(200).json([
      { username: "testuser", highscore: 1000 },
      { username: "system", highscore: 500 }
    ]);

    // if the data doesn't exist then return blank
    if (!dbSnap.exists()) {
      console.log('📊 No leaderboard data found');
      return res.status(200).send([]);
    } else {
      // else return the data with additional safety checks
      const dataRaw = dbSnap.val();
      
      // Safety check for data structure
      if (!dataRaw || typeof dataRaw !== 'object') {
        console.log('📊 Invalid leaderboard data structure, returning empty');
        return res.status(200).send([]);
      }
      
      // Validate and filter data
      const validEntries = [];
      for (const [key, value] of Object.entries(dataRaw)) {
        if (value && typeof value === 'object' && typeof value.highscore === 'number' && value.username) {
          validEntries.push({
            username: value.username,
            highscore: value.highscore,
            timestamp: value.timestamp || Date.now()
          });
        }
      }
      
      const data = validEntries.sort((a, b) => b.highscore - a.highscore).slice(0, 15);
      console.log(`📊 Returning ${data.length} leaderboard entries`);
      res.status(200).send(data);
    }
  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    // Always return valid response to prevent frontend errors
    res.status(200).json([]);
  }
});

// /times get request that returns the top 15 data from the db sorted by time in ascending order
app.get('/times', async (req, res) => {
  try {
    console.log('⏱️ Times request received');
    
    if (!db) {
      console.error('❌ Database not initialized');
      return res.status(500).json({ error: 'Database not available' });
    }

    // get the data from the database with timeout
    console.log('⏱️ Fetching from Firebase times table...');
    
    // Add shorter timeout to prevent stack overflow
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firebase timeout')), 5000)
    );
    
    // TEMPORARILY DISABLE Firebase read due to corruption
    console.log('🚨 Firebase times table temporarily disabled due to corruption');
    return res.status(200).json([
      { username: "testuser", time: 120 },
      { username: "system", time: 180 }
    ]);

    // if the data doesn't exist then return blank
    if (!dbSnap.exists()) {
      console.log('⏱️ No times data found');
      return res.status(200).send([]);
    } else {
      // else return the data with additional safety checks
      const dataRaw = dbSnap.val();
      
      // Safety check for data structure
      if (!dataRaw || typeof dataRaw !== 'object') {
        console.log('⏱️ Invalid times data structure, returning empty');
        return res.status(200).send([]);
      }
      
      // Validate and filter data
      const validEntries = [];
      for (const [key, value] of Object.entries(dataRaw)) {
        if (value && typeof value === 'object' && typeof value.time === 'number' && value.username) {
          validEntries.push({
            username: value.username,
            time: value.time,
            timestamp: value.timestamp || Date.now()
          });
        }
      }
      
      const data = validEntries.sort((a, b) => a.time - b.time).slice(0, 15);
      console.log(`⏱️ Returning ${data.length} time entries`);
      res.status(200).send(data);
    }
  } catch (error) {
    console.error('❌ Times error:', error);
    // Always return valid response to prevent frontend errors
    res.status(200).json([]);
  }
});

// /getscore get request that returns all the data from the db sorted by highscore in descending order
app.get('/getscore', async (req, res) => {
  // get the data from the database
  const dbRef = ref(db, 'users'); 
  const dbSnap = await get(dbRef);

  // if the data doesn't exist then return blank
  if (!dbSnap.exists()) {
    return res.status(200).send([]);
  } else {
    // else return the data
    const dataRaw = dbSnap.val();
    const data = Object.values(dataRaw).sort((a, b) => b.highscore - a.highscore);
    res.status(200).send(data);
  }
});

// /gettime get request that returns all the data from the db sorted by time in ascending order
app.get('/gettime', async (req, res) => {
  // get the data from the database
  const dbRef = ref(db, 'times');
  const dbSnap = await get(dbRef);

  // if the data doesn't exist then return blank
  if (!dbSnap.exists()) {
    return res.status(200).send([]);
  } else {
    // else return the data
    const dataRaw = dbSnap.val();
    const data = Object.values(dataRaw).sort((a, b) => a.time - b.time);
    res.status(200).send(data);
  }
});

// /getuser/:username get request that returns the data of the user with the username passed in the url
app.get('/getuser/:username', async (req, res) => {
  let { username } = req.params;

  // if username has any invalid characters for firebase (., #, $, [, ], /) remove them
  let usernameOld = username;
  username = username.replace(/[.,#$\[\]\/]/g, '');

  // get the data from the database
  const dbRef = ref(db, 'users/' + username);
  const dbSnap = await get(dbRef);

  const dbRef_time = ref(db, 'times/' + username);
  const dbSnap_time = await get(dbRef_time);

  let data = { username: usernameOld, highscore: 0, time: 0 };

  // if data exists then return the data
  if (dbSnap.exists()) {
    data = dbSnap.val();
  }

  if (dbSnap_time.exists()) {
    data.time = dbSnap_time.val().time;
  } else {
    data.time = 0;
  }

  res.status(200).send(data);
});

// /rewardpool get request that returns the current reward pool post link is in the db
app.get('/rewardpool', async (req, res) => {
  // get the data from the database
  const dbRef = ref(db, 'link');
  const dbSnap = await get(dbRef);
  
  // if link doesn't exist then return the last post by the account
  if (!dbSnap.exists()) {
    const posts = await client.hivemind.getAccountPosts({ account: process.env.ACCOUNT, limit: 1, sort: 'posts' })
    return res.status(200).send(posts[0]);
  }

  // else return the post with the link
  const link = dbSnap.val();
  try {
    const post = await client.database.call('get_content', [process.env.ACCOUNT, link.link]);
    res.status(200).send({ post, link: link.link, week: link.week });
  } catch (err) {
    res.status(200).send({
      post: {
        author: process.env.ACCOUNT,
        permlink: link.link,
        title: 'Post not found',
        pending_payout_value: '0.000 HBD',
        active_votes: [],
      },
      link: link.link,
      week: link.week
    });
  }
});

// sql endpoint also make sure the request is from the whitelist and then next to hivesql
app.post('/sql', async (req, res, next) => {
  if (!whitelist.includes(req.headers.origin) && process.env.NODE_ENV != 'development') {
    return res.status(400).send('Bad request');
  }

  next();
}, getQuery);

// Railway sets PORT automatically, but fallback to common ports
const port = process.env.PORT || process.env.HTTP_PORT || 3000;

// Add process error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Starting server...');
console.log(`Node.js version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`PORT environment variable: ${process.env.PORT}`);
console.log(`Resolved port: ${port}`);
console.log(`Available environment variables:`, Object.keys(process.env).filter(key => key.includes('PORT')));

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server started successfully on port ${port}`);
  console.log(`✅ Health check available at http://0.0.0.0:${port}/`);
  console.log(`✅ Auth key configured: ${process.env.AUTH_KEY ? 'Yes' : 'No'}`);
  console.log(`✅ Account configured: ${process.env.ACCOUNT ? 'Yes' : 'No'}`);
  console.log(`✅ Server is ready to accept connections`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});
