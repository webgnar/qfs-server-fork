# QFS Server - Railway Deployment Guide

## Prerequisites
- GitHub repository with your QFS server code
- Railway account (https://railway.app)
- Environment variables ready

## Required Environment Variables

Set these in Railway's dashboard after deployment:

### Authentication & Security
```
AUTH_KEY=your_jwt_secret_key_here
POSTING_KEY=your_hive_posting_private_key
ACCOUNT=your_hive_account_name
```

### Environment
```
NODE_ENV=production
```

**Note:** `PORT` is automatically set by Railway, no need to configure it.

## Step-by-Step Deployment

### 1. Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Connect your GitHub account if not already connected
4. Select your QFS-server repository
5. Railway will automatically detect it's a Node.js project

### 2. Configure Environment Variables
1. In your Railway project dashboard, go to the "Variables" tab
2. Add each environment variable:
   - `AUTH_KEY`: Generate a strong random string (use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `POSTING_KEY`: Your Hive account's posting private key
   - `ACCOUNT`: Your Hive account username
   - `NODE_ENV`: `production`

### 3. Firebase Configuration
Your `firebase.json` file should already be in the repository. Railway will automatically use it.

### 4. Verify Deployment
After deployment, Railway will provide you with a URL like:
```
https://your-app-name.railway.app
```

Test your endpoints:
- `GET https://your-app-name.railway.app/leaderboard`
- `GET https://your-app-name.railway.app/times`
- `GET https://your-app-name.railway.app/rewardpool`

## Important Notes

### CORS Configuration
Your CORS whitelist is currently configured for development and these domains:
- `https://dev.skatehive.app`
- `https://www.skatehive.app` 
- `https://www.stoken.quest`
- `http://localhost:3000`
- `http://localhost:3002`

**After Frontend Deployment:** Update the whitelist in `index.js` to include your production frontend URL:
```javascript
const whitelist = [
  // ... existing domains ...
  'https://your-frontend.vercel.app',  // Add your actual frontend URL
];
```

### Security Features
✅ HTTPS enforcement (automatically redirects HTTP to HTTPS in production)
✅ CORS protection with whitelist
✅ JWT token authentication
✅ Environment-based configuration

### Health Check
Railway will use the `/leaderboard` endpoint for health checks as configured in `railway.toml`.

## Post-Deployment Checklist

1. **Test all endpoints** using the Railway URL
2. **Update frontend configuration** with the new Railway API URL
3. **Update CORS whitelist** to include your frontend production domain
4. **Monitor logs** in Railway dashboard for any issues
5. **Test authentication flow** end-to-end

## Common Issues

### Environment Variables Not Loading
- Ensure `dotenv` is installed: `npm install dotenv`
- Check that variables are set in Railway dashboard
- Verify variable names match exactly (case-sensitive)

### CORS Errors
- Add your frontend domain to the whitelist
- Deploy the updated CORS configuration
- Clear browser cache if testing

### Firebase Connection Issues
- Verify `firebase.json` is in the repository
- Check Firebase project settings
- Ensure Firebase rules allow your operations

## API Endpoints

Your deployed server will expose these endpoints:

### Authentication
- `GET /token/:username` - Get JWT token for user
- `GET /token/external/:username` - Get external JWT token
- `POST /verify` - Verify JWT token

### Game Data
- `POST /pushscore` - Submit game score
- `GET /leaderboard` - Get top 15 scores
- `GET /times` - Get top 15 times
- `GET /getscore` - Get all scores
- `GET /gettime` - Get all times
- `GET /getuser/:username` - Get user data

### Hive Integration
- `GET /rewardpool` - Get current reward pool info
- `POST /sql` - HiveSQL queries (restricted access)

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify environment variables are set correctly
3. Test endpoints individually
4. Check CORS configuration for frontend integration
