window.parent.postMessage({ name: 'getStats' }, '*');

// message event listener from parent window
window.addEventListener('message', function(event) {
  if (event.data.name === 'setStats') {
    console.log('setStats', event.data);
    setFullStore(event.data.data);

    // window.location.reload();
  }
});

// watch for changes to the stats (localstorage)
setInterval(function() {
  // get highscore from local storage
  const update = Number(getStore("Update") || 0);

  // if update is provided
  if (update === 1) {
    // send stats to parent window
    window.parent.postMessage({ name: 'setStats', data: getFullStore() }, '*');
  }
}, 1000);

function getFullStore() {
  const game = localStorage.getItem('QuestForStoken.0.game.sav');
  return game;
}

function setFullStore(game) {
  localStorage.setItem('QuestForStoken.0.game.sav', game);
}

function getStore(key) {
  // load game storage (QuestForStoken.0.game.sav)
  const game = localStorage.getItem('QuestForStoken.0.game.sav');

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
