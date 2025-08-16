$(document).ready(function () {
// play sound when login button is clicked
const button = document.getElementById('action');
const audio = document.getElementById('loginSound');
button.addEventListener('click', () => {
  audio.play().catch(error => {
    console.error('Failed to play audio:', error);
  });
});

  // create iframe element
  const game = `<iframe src="QFS/index.html" width="1280" height="720"></iframe>`;

  let USERNAME = '';
  const token = localStorage.getItem('token');

  // if already logged in, verify login
  if (token) {
    verify(token);
  } else {
    setStore("Username", "guest");
    setStore("Highscore", 0);

    // add game to dom next to #game
    $('#game').after(game);
    
    // scroll to game no animation
    $('html, body').scrollTop($('#game').offset().top);
  }

  $('#action').click(async function() {
    // get action from data-action attribute
    const action = $(this).attr('data-action');

    // if action is login
    if (action === 'login') {
      const username = $('#username_input').val();
    
      try {
        // request the token to decode and verify from api
        const rawtoken = await req(`token/${username}`);

        // if token is provided
        if (rawtoken) {
          // try to decode token using hive_keychain (active key)
          hive_keychain.requestVerifyKey(
            username,
            rawtoken,
            'Posting',
            async function(response) {
              // if token is verified
              if (response.success) {
                // get token from response (remove # from token)
                const token = response.result.substring(1);

                // save token to local storage
                localStorage.setItem('token', token);

                // refresh page
                location.reload();
              } else {
                alert('Could not verify token');
              }
            }
          )
        }
      } catch (error) {
        alert('Invalid username');
        console.log(error);
      }
    } else if (action === 'logout') {
      // remove token from local storage
      localStorage.removeItem('token');

      // refresh page
      location.reload();
    }
  });

  // vote on post
  $('#vote').click(async function() {
    // get permlink from data-permlink attribute
    const link = $(this).data('permlink');
    const author = link.split('/')[0];
    const permlink = link.split('/')[1];

    // get token from local storage
    const token = localStorage.getItem('token');

    // if no token is provided
    if (!token) {
      alert('Please login first');
      return;
    }

    // vote through hive_keychain
    hive_keychain.requestVote(
      USERNAME,
      permlink,
      author,
      10000,
      async function(response) {
        // if vote is successful
        if (response.success) {
          $('#vote').prop('disabled', true);
          $('#vote').html('Voted already');
        } else {
          alert('Could not vote');
        }
      }
    );
  });

  // check hive_keychain
  if (!window.hive_keychain) {
    $('#login_btn').prop('disabled', true);
    $('#login_btn').html('Hive Keychain not found');
  }

  // get reward pool post
  async function getRewardPool() {
    const { post } = await req('rewardpool');
    
    const pending_payout = parseFloat(post.pending_payout_value.split(' ')[0]) / 2;
    const reward_pool = (pending_payout / 2).toFixed(3);

    // if post is provided
    if (post) {
      // set post
      $("#post_title").text(post.title);
      $('#link').attr('href', `https://peakd.com/@${post.author}/${post.permlink}`);
      $('#rewardpool').text(`reward pool: ~${reward_pool} HBD`);
      $('#vote').attr('data-permlink', `${post.author}/${post.permlink}`);

      // if user is in the voters list
      const voted = post.active_votes.find(vote => vote.voter === USERNAME);
      if (voted) {
        $('#vote').prop('disabled', true);
        $('#vote').html('Voted already');
      }
    }
  }

  getRewardPool();

  const fire_icon = 
  `<img src="./images/fire.gif" width="20" height="20" style="margin-left: 5px; margin-bottom: -2px;">`;

  // load leaderboard
  async function loadLeaderboard() {

    $('#leaderboard').html(`<td colspan="3">loading...</td>`);
    $('#besttimes').html(`<td colspan="3">loading...</td>`);

    const leaderboard = await req('leaderboard');

    // if leaderboard is provided
    if (leaderboard && leaderboard.length > 0) {
      $('#leaderboard').html('');
      // loop through leaderboard
      for (let i = 0; i < leaderboard.length; i++) {
        // create leaderboard row
        const row = `
          <tr>
            <td>${i + 1}</td>
            <td><a target="_blank" target="_blank" href="https://peakd.com/@${leaderboard[i].username}" class="lb_link">${leaderboard[i].username}</a></td>
            <td>${leaderboard[i].highscore.toFixed(0)} ${ i === 0 ? fire_icon : '' }</td>
          </tr>
        `;

        // append row to leaderboard
        $('#leaderboard').append(row);
      }
    } else {
      $('#leaderboard').html(`<td colspan="3">no highscores found</td>`);
    }

    const best_times = await req('times');

    // if besttimes is provided
    if (best_times && best_times.length > 0) {
      $('#besttimes').html('');
      // loop through besttimes
      for (let i = 0; i < best_times.length; i++) {
        let time = best_times[i].time;

        // convert seconds to minutes and seconds
        if (time > 60) {
          const minutes = Math.floor(time / 60);
          const seconds = time - minutes * 60;
          time = `${minutes}m ${seconds}s`;
        } else {
          time = `${time}s`;
        }

        // create besttimes row
        const row = `
          <tr>
            <td>${i + 1}</td>
            <td><a target="_blank" href="https://peakd.com/@${best_times[i].username}" class="lb_link">${best_times[i].username}</a></td>
            <td>${time} ${ i === 0 ? fire_icon : '' }</td>
          </tr>
        `;

        // append row to besttimes
        $('#besttimes').append(row);
      }
    } else {
      $('#besttimes').html(`<td colspan="3">no best times found</td>`);
    }
  }

  loadLeaderboard();

  // verify utility function
  async function verify(token) {
    // verify token
    try {
      const data = await req('verify', 'POST', false, token);

      if (data) {
        // set username
        USERNAME = data.username;
        $('#username').text(`@${data.username}`);
        $('#username_input').hide();
        $('#action').html('Logout');
        $('#action').attr('data-action', 'logout');
      }

      // get highscore
      let userdata = await req(`getuser/${data.username}`);

      if (!userdata) {
        userdata = { highscore: 0, time: 0 };
      }

      // set highscore
      $('#highscore').text(`highscore: ${userdata.highscore}`);
      // set time
      $('#time').text(`time: ${userdata.time || '---'}`);

      // set game storage
      setStore("Username", data.username);
      setStore("Highscore", userdata.highscore);
      setStore("Time", userdata.time);

      $('#game').after(game);
      $('html, body').scrollTop($('#game').offset().top);

      // inveral for looking score updates in the local storage
      setInterval(async function() {
        // get highscore from local storage
        const update = Number(getStore("Update") || 0);

        // if update is provided
        if (update === 1) {
          removeStore("Update");

          // get highscore from local storage
          const highscore = Number(getStore("Highscore"));
          const time = Number(getStore("Time"));

          const token = localStorage.getItem('token');

          // update highscore on server
          await req('pushscore', 'POST', { highscore, time }, token);

          // set highscore
          $('#highscore').text(`highscore: ${highscore}`);
          // set time
          $('#time').text(`time: ${time || '---'}`);

          // update leaderboard
          loadLeaderboard();
        }
      }, 3000);

    } catch (error) {
      // remove token from local storage
      localStorage.removeItem('token');

      // refresh page
      location.reload();
    }
  }
});

// send request utility function
async function req(req, method = 'GET', body = false, token = false) {
  // headers
  let headers = {
    'Content-Type': 'application/json',
  };

  // if token is provided
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // stringify body if provided
  if (body) {
    body = JSON.stringify(body);
  }

  // ajax request
  const data = await $.ajax({
    url: `/${req}`,
    type: method,
    headers,
    data: body,
    contentType: false,
    processData: false,
  });

  return data;
}

// game storage
function setStore(key, value) {
  // load game storage (QuestForSkateboarding.0.game.sav)
  let game = localStorage.getItem('QuestForSkateboarding.0.game.sav');

  // if no game storage is provided
  if (!game) {
    // create game storage
    game = '[qfs]\n';
    game += `${key}="${value}"`;
  }

  // split game storage into lines
  const lines = game.split('\n');

  let found = false;

  // loop through lines
  for (let i = 0; i < lines.length; i++) {
    // if line contains key
    if (lines[i].includes(key)) {
      found = true;
      // replace line with new value
      lines[i] = `${key}="${value}"`;
      break;
    }
  }

  // if key is not found
  if (!found) {
    // add new line with key and value
    lines.push(`${key}="${value}"`);
  }

  // save game storage
  localStorage.setItem('QuestForSkateboarding.0.game.sav', lines.join('\n'));
}

// game storage
function getStore(key) {
  // load game storage (QuestForSkateboarding.0.game.sav)
  const game = localStorage.getItem('QuestForSkateboarding.0.game.sav');

  // if no game storage is provided
  if (!game) {
    return false;
  }

  // split game storage into lines
  const lines = game.split('\n');

  // loop through lines
  for (let i = 0; i < lines.length; i++) {
    // if line contains key
    if (lines[i].includes(key)) {
      // return value
      const value = lines[i].split('=')[1];
      // remove quotes
      return value.replace(/"/g, '');
    }
  }

  return false;
}

// game storage
function removeStore(key) {
  // load game storage (QuestForSkateboarding.0.game.sav)
  const game = localStorage.getItem('QuestForSkateboarding.0.game.sav');

  if (game) {
    // split game storage into lines
    const lines = game.split('\n');

    // loop through lines
    for (let i = 0; i < lines.length; i++) {
      // if line contains key
      if (lines[i].includes(key)) {
        // remove line
        lines.splice(i, 1);
        break;
      }
    }

    // save game storage
    localStorage.setItem('QuestForSkateboarding.0.game.sav', lines.join('\n'));
  }
}
