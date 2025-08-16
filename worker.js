require('dotenv').config();
const hive = require('@hiveio/hive-js');
const fs = require('fs');

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');

const config = require('./firebase.json');

// Initialize Firebase
const fb = initializeApp(config);

const db = getDatabase(fb);

// set api
hive.api.setOptions({ url: 'https://api.hive.blog' });

const ACCOUNT = process.env.ACCOUNT;
const POSTING_KEY = process.env.POSTING_KEY;
const ACTIVE_KEY = process.env.ACTIVE_KEY;

const chainTypes = require('@hiveio/hive-js/lib/auth/serializer/src/ChainTypes');
const makeBitMaskFilter = require('@hiveio/hive-js/lib/auth/serializer/src/makeBitMaskFilter');

// construct the filter for author reward operations
const op = chainTypes.operations;
const filter = makeBitMaskFilter([
  op.author_reward,
]);

// claim pending rewards
const claimRewards = async () => {
  // get pending rewards
  const acc = await hive.api.getAccountsAsync([ACCOUNT]);
  const reward_hbd = acc[0].reward_hbd_balance;
  const reward_hive = acc[0].reward_hive_balance;
  const reward_vests = acc[0].reward_vesting_balance;

  // if there are no pending rewards then return
  if (reward_hbd === '0.000 HBD'
    && reward_hive === '0.000 HIVE'
    && reward_vests === '0.000000 VESTS') {
    return;
  }


  // claim pending rewards
  await hive.broadcast.claimRewardBalanceAsync(
    POSTING_KEY,
    ACCOUNT,
    reward_hive,
    reward_hbd,
    reward_vests,
  );

  console.log(`\n@${ACCOUNT} claimed ${reward_hbd} ${reward_hive} ${reward_vests}`);
};

// get the last automated post reward of the bot which is the reward pool
const getRewardPool = async (start = -1) => {
  try {
    const history = await hive.api.getAccountHistoryAsync(
      ACCOUNT,
      start, 30,
      filter[0],
      filter[1],
    );

    // get the link of the last automated post from the database
    const dbRef = ref(db, 'link');
    const dbSnap = await get(dbRef);

    // if the link doesn't exist then return the last reward
    if (!dbSnap.exists()) {
      console.log(`\nReward pool is ${history[0][1].op[1].hbd_payout} for @${ACCOUNT}/${history[0][1].op[1].permlink}`);

      return {
        pool: history[0][1].op[1],
        week: 0,     
      };
    }

    const link = dbSnap.val();

    const reward = history.find((h) => h[1].op[1].permlink === link.link);

    // if the reward is found then return it
    if (reward) {
      console.log(`\nReward pool is ${reward[1].op[1].hbd_payout} for @${ACCOUNT}/${link.link}`);

      return {
        pool: reward[1].op[1],
        week: link.week,
      };
    } else {
      // if the reward is not found then return null
      console.log(`\nThe reward is not from the last automated post @${ACCOUNT}/${link.link}`);
      
      return null;
    }
  }
  catch (err) {
    // strart from the given sequence number if the bot has no history
    if (err.data.code === 10) {
      const sequence = err.data.stack[0].data.sequence;
      return await getRewardPool(sequence);
    } else {

      console.log(`\nNo rewards found`);

      return null;
    }
  }
};

// function to clear the users database
const clear = async () => {
  const dbRef = ref(db, 'users');
  await set(dbRef, {});

  // also clear best time
  const bestRef = ref(db, 'times');
  await set(bestRef, {});
};

// get top 15 high scores and determine their share % from the grand total high score
const calculateShares = async (db) => {
  console.log('\nCalculating shares of the top 15 high scores');

  // sort the db.json by highscore in descending order
  db.sort((a, b) => b.highscore - a.highscore);
  // get the top 15 high scores
  const top = db.slice(0, 15);
  // get the grand total high score
  const total = top.reduce((acc, user) => acc + user.highscore, 0);

  const shares = top.map((user) => {
    // calculate the share % of each user and round it to 2 decimal places
    const share = Math.round((user.highscore / total) * 100 * 100) / 100;
    return { ...user, share };
  });

  return shares;
};

// calculate and distribute rewards to the top 15 high scores
const processRewards = async () => {

  // claim pending rewards
  await claimRewards();

  // get the last automated post reward of the bot which is the reward pool
  const reward = await getRewardPool();

  // if there is no reward then try again in 5 minutes
  if (!reward) {
    setTimeout(processRewards, 5 * 60 * 1000);
    return;
  }

  console.log(`----------------------------------------`);
  console.log(`\nProcessing rewards at ${new Date()}`);

  // hbd reward
  const pool = parseFloat(reward.pool.hbd_payout.split(' ')[0]);

  // week number
  const week = reward.week + 1;

  // get the shares of the top 15 high scores
  const dbRef = ref(db, 'users');
  const dbSnap = await get(dbRef);

  // if there are no high scores then return
  if (!dbSnap.exists()) {
    console.log(`\nNo high scores found`);
    console.log(`\n----------------------------------------\n`);
    return;
  }

  const dataRaw = dbSnap.val();
  const data = Object.values(dataRaw);

  const shares = await calculateShares(data);

  // calculate the reward amount for each user to 3 decimal places and round it down
  const rewards = shares.map((user) => {
    const reward = (Math.floor((pool * user.share) / 100 * 1000) / 1000);

    if (reward < 0.001) {
      return { ...user, reward: 0.000 };
    }

    return { ...user, reward };
  });

  // console log the rewards table
  console.log('\nRewards table');
  console.table(rewards, ['username', 'highscore', 'share', 'reward']);
  console.log(`\n`);

  // distribute rewards to the top 15 high scores
  for (const user of rewards) {
    // if the reward is less than 0.001 HBD then skip
    if (user.reward < 0.001)
      continue;

    // transfer the reward to the user
    const transfer = await hive.broadcast.transferAsync(
      ACTIVE_KEY,
      ACCOUNT,
      user.username,
      `${user.reward.toFixed(3)} HBD`,
      `@${ACCOUNT} weekly reward for high score of ${user.highscore}`,
    );

    // log with transaction id
    console.log(`Sent ${user.reward} HBD to @${user.username} - ${transfer.id}`);
  }

  // send each of them 1 GNAR token
  let json_arr = [];

  for (const user of rewards) {
    const json = {
      contractName: 'tokens',
      contractAction: 'transfer',
      contractPayload: {
        symbol: 'GNAR',
        to: user.username,
        quantity: '1.000',
        memo: `@${ACCOUNT} GnarCoin reward for highscore of ${user.highscore}`,
      },
    };

    json_arr.push(json);

    // log with transaction id
    console.log(`Sent 1 GNAR token to @${user.username}`);
  }

  // transfer the GNAR token to each user
  let transfer = await hive.broadcast.customJsonAsync(
    ACTIVE_KEY,
    [ACCOUNT],
    [],
    'ssc-mainnet-hive',
    JSON.stringify(json_arr),
  );

  // log with transaction id
  console.log(`Sent 1 GNAR token to each of the top 15 high scores - ${transfer.id}`);

  // get top 15 best times of the week and send 1 GNAR token to each of them
  const bestRef = ref(db, 'times');
  const bestSnap = await get(bestRef);
  
  let best15 = [];
  // if there are best times then send 1 GNAR token to each of them
  if (bestSnap.exists()) {
    const bestRaw = bestSnap.val();
    const best = Object.values(bestRaw);
    
    // sort the best times by ascending order
    const bestSorted = best.sort((a, b) => a.time - b.time);

    // get the top 15 best times
    best15 = bestSorted.slice(0, 15);

    // console log the best times table
    console.log('\nBest times table');
    console.table(best15, ['username', 'time']);
    console.log(`\n`);

    // send 1 GNAR token to each of them

    json_arr = [];

    for (const user of best15) {
      const json = {
        contractName: 'tokens',
        contractAction: 'transfer',
        contractPayload: {
          symbol: 'GNAR',
          to: user.username,
          quantity: '1.000',
          memo: `@${ACCOUNT} GNAR token reward for completing Quest For Stoken with a time of ${user.time} seconds`,
        },
      };

      json_arr.push(json);

      // log
      console.log(`Sent 1 GNAR to @${user.username}`);
    }
  }

  // transfer the GNAR token to each user
  transfer = await hive.broadcast.customJsonAsync(
    ACTIVE_KEY,
    [ACCOUNT],
    [],
    'ssc-mainnet-hive',
    JSON.stringify(json_arr),
  );

  // log with transaction id
  console.log(`Sent 1 GNAR to each of the top 15 best times - ${transfer.id}`);

  const newlink = `the-quest-for-stoken-week-${week}`;

  // make the weekly reward post following post.md
  const template = fs.readFileSync('./post.md', 'utf8');

  // add the reward table to the post [username, score, time, rank, share, reward]
  const table = rewards.map((user, i) => {
    const rank = i + 1;
    return `| ${rank} | @${user.username} | ${user.highscore} | ${user.share.toFixed(2)}% | ${user.reward.toFixed(3)} HBD & 1 Gnar Coin|`;
  }).join('\n');

  let body = template.replace('{{table}}', table);

  if (best15.length === 0) {
    body = body.replace('{{best_times}}', '| No winners this week! |||||');
  } else {
    const times_table = best15.map((user, i) => {
      const rank = i + 1;

      // convert the time to minutes and seconds
      if (user.time > 60) {
        const minutes = Math.floor(user.time / 60);
        const seconds = user.time - minutes * 60;
        user.time = `${minutes}m ${seconds}s`;
      } else {
        user.time = `${user.time}s`;
      }

      return `| ${rank} | @${user.username} | ${user.time} | 1 Gnar Coin |`;
    }).join('\n');

    body = body.replace('{{times_table}}', times_table);
  }

  const post = await hive.broadcast.commentAsync(
    POSTING_KEY, // posting key
    '', // parent author
    'hive-173115', // parent permlink
    ACCOUNT, // author
    newlink, // permlink
    `Quest For Skateboarding week ${week}`, // title
    body, // body
    {
      app: 'qfs-server',
      tags: [
        'hive-173115', // community tag
        'hivegaming',
        'web3gaming',
        'play2earn',
        'gamedev',
        'proofofbrain',
        'hive-engine',
        'gamemaker',
        'alienarthive',
        'stoken',
        'neoxian',
        'hivegc',


      ],
      description: `This week's Quest for Skateboarding!`,
      format: 'markdown',
      image: [
        // first is the thumbnail
        'https://images.hive.blog/0x0/https://files.peakd.com/file/peakd-hive/stoken.quest/EoCfjfPAMovDWgmWdX9uWvfkvFmyizXwNnvct4ddahvsdpzU6fXUMJCqe6RHoUHyPuv.gif',
        'https://files.peakd.com/file/peakd-hive/stoken.quest/EoCi4Y43qwmdZRjtY9fEBHMTG1zocqyRhiQhrk6VKfv8MUrgcZ5okKUcZBTKLqLqLEe.png',
        'https://files.peakd.com/file/peakd-hive/stoken.quest/AJehWC6tQG9NVwqsQ9ozkTDRyFafPX6cKPf6B2KUTkQZaRzb6BuFeL4MV8nTwng.gif',
        'https://files.peakd.com/file/peakd-hive/stoken.quest/23wgHJjHUQD6iaZmxn2fTVFNC9PgpSVaWKXsdGCuPFia9RV5KKVZvhcBba6PiRjCzdTd2.png',
        'https://files.peakd.com/file/peakd-hive/stoken.quest/23vsUyQtaxW4iNEyKLxbbMjTDRQFTBK1VMqaXxc7LN9ARpmZYY5DwwTiwZyWEcZekiHUZ.gif'
      ]
    }, // json metadata
  );

  // log with transaction id and permlink
  console.log(`\nPosted weekly rewards @${ACCOUNT}/${newlink} - ${post.id}`);

  // update the link in db with the new permlink
  await set(ref(db, 'link'), { link: newlink, week: week });
  console.log(`\nUpdated link with new permlink`);

  // clear the db.json file
  clear();
  console.log(`\nCleared database file`);

  console.log(`\n----------------------------------------\n`);

  // start trying again after 5 minutes
  setTimeout(processRewards, 5 * 60 * 1000);

  // // again after 7 days
  // setTimeout(processRewards, 7 * 24 * 60 * 60 * 1000);
}

processRewards();
