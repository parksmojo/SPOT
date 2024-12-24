/*
    This file:
        - Does all of the main computation
        - Uses the data access functions to interact with data
*/


const { getGame, testingEndpoint, getJoinableGames, insertGeoData, getActiveSessions, startSession, endSession, getSession, getStatusOfPlayersInGame, updateGamePhase, recordComms, joinedPlayerState, checkJoinableGame, updatePlayerState, getPlayerStatus, makeGame, setLeftGamePlayerState, checkInBoundary, createTrail, getPlayersInGame, getEndedGames: getEndedGames, getEndedGameInfo, getGameStatusData, calculateAreaScore, checkGameDuration, giveNewObject, getAllDrops, createLocationObject, getPlayerPosition, updateCameras, endOfPhase1Duration, grabDeadDropAssignment, removeDeadDropAssignment, grabDeadDrops, assignDrop, getDistToSafeZone, logoutInactivePlayers, getPlacedItems, getInventory, updateGameState, calculateSafeZoneScore, createTeamZones, setPlayerZone, setupCameras, getFlags, updateObjPos, updateFlagPos, getFlagLocations, setGameStartTime} = require('./data-access');
const { setDrop, giveLandmine, giveTrap, checkitemContact, randomDropItem } = require('./game-actions');
const { GameConsts: gc } = require('./game-const');
const { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, DescribeSecretCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secret_name = "SPOT";
const region = 'us-east-1';
const updateIntervalMs = 5 * 1000; //used to check if cache can be used

const client = new SecretsManagerClient({ region });

async function getSecretValue() {
  try {
    //console.log('Grabbing secrets!')
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );
    //console.log('Secrets have been grabbed!')
    return JSON.parse(response.SecretString || '{}'); // Safely parse or return an empty object
  } catch (error) {
    console.error('Failed to retrieve the secret:', error);
    throw error; // Propagate the error for higher-level handling
  }
}

async function checkCache(key) {
  try {
    // Retrieve the current secret value
    const currentSecret = await getSecretValue();
    const entry = currentSecret[key] || {};
    
    // Determine if processing is needed based on timestamp
    const lastUpdatedTime = new Date(entry.lastUpdated || 0).getTime();
    const currentTime = Date.now();
    const isRecent = (currentTime - lastUpdatedTime) < updateIntervalMs;
    
    return { isRecent: isRecent, data: entry.value };
  } catch (error) {
    console.error('Error while checking if processing is needed:', error);
    return { isRecent: true, data: null }; // Assume processing is needed on error
  }
}

async function updateSecret(key, value) {
  try {
    // Retrieve the current secret value
    const currentSecret = await getSecretValue();
    
    // Prepare updated secret data
    const updatedSecret = {
      ...currentSecret,
      [key]: {
        value,
        lastUpdated: new Date().toISOString(),
      },
    };

    // Update the secret in Secrets Manager
    const response = await client.send(
      new PutSecretValueCommand({
        SecretId: secret_name,
        SecretString: JSON.stringify(updatedSecret),
      })
    );
    console.log('Secret updated or created:', key);
    return response;
  } catch (error) {
    console.error('Failed to update or create the secret:', error);
    throw error; // Propagate the error for higher-level handling
  }
}

async function deleteSecret(key) {
  try {
    // Retrieve the current secret value
    console.log('Retrieving secret value...')
    const currentSecret = await getSecretValue();
    
    if (!currentSecret[key]) {
      console.log('The specified key does not exist in the secret.');
      return;
    }

    // Remove the key from the secret data
    delete currentSecret[key];

    // Update the secret in Secrets Manager with the modified data
    const response = await client.send(
      new PutSecretValueCommand({
        SecretId: secret_name,
        SecretString: JSON.stringify(currentSecret),
      })
    );
    console.log('Secret value deleted:', key);
    return response;
  } catch (error) {
    console.error('Failed to delete the secret value:', error);
    throw error; // Propagate the error for higher-level handling
  }
}

exports.login = async (username, deviceID) => {
  console.log("Logging in");
  await logoutInactivePlayers();
  const activeSessions = await getActiveSessions();
  for(let row of activeSessions){
    if(row.username === username){
      throw { code: 403, message: 'Username already logged in'};
    } else if(row.device_id === deviceID){
      throw { code: 403, message: 'Device already has active user'};
    }
  }
  const newSession = await startSession(username, deviceID);
  return newSession.session_id;
}

exports.logout = async (sessID) => {
  console.log("Logging out user");
  const response = await endSession(sessID);
  if(!response){
    throw { code: 403, message: 'Session not found or already ended' };
  }
}

async function verifySession(sessionID){
  console.log("Verifying Session:",sessionID);
  const response = await getSession(sessionID);
  if(response){
    return true;
  }
  return false;
}

exports.joinGame = async (sessionID, gameID) => {
  console.log("Joining a game");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  if(!await checkJoinableGame(gameID)){
    throw { code: 403, message: 'Requested game is not joinable' }
  }
  await joinedPlayerState(gameID, sessionID);
  const game = await getGame(gameID);
  // determines if the game type is captuer the flag and assigns a color 
  if (game.game_type === gc.CAPTURE_THE_FLAG){
    await assignTeam(gameID, sessionID, game.game_config.teamAColor, game.game_config.teamBColor);
  }
  return game;
}

// loops through the player list to determine the team with fewer playeres 
async function assignTeam(gameID, sessionID, colorA, colorB){
  const players = await getPlayersInGame(gameID);
  let teamA = 0;
  let teamB = 0;
  players.forEach(player => {
    if (player.team === colorA) {
      teamA++;
    } else if (player.team === colorB) {
      teamB++;
    }
  });
  // assigns new players to the team with fewer players 
  let newTeam = colorA; 
  if (teamA > teamB){
    newTeam = colorB;
  }
  await updatePlayerState(gameID, sessionID, '00000000', newTeam);
}

exports.leaveGame = async (sessionID, gameID) => {
  console.log("Leaving game", gameID);
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  const currPlayerStatus = await getPlayerStatus(gameID, sessionID);
  if(!currPlayerStatus || currPlayerStatus.player_state === '00000000' || currPlayerStatus.player_state === '00000100'){
    throw { code: 403, message: 'User is trying to leave a game they are not in'}
  }
  await setLeftGamePlayerState(gameID, sessionID);
}

async function deleteOldCache() {
  const minuteInterval = 10;
  const data = await getSecretValue();
  const currTime = Date.now()
  let lastUpdated;

  try {
    for (const key in data) { 
        lastUpdated = new Date(data[key].lastUpdated).getTime();
        if ((currTime - lastUpdated) > minuteInterval * 60 * 1000) {
          console.log('[ClearLag] Secret key', key, 'has been deleted.')
          await deleteSecret(key);
        }
    }
  } catch (error) {
    console.error('Error deleting old cache:', error);
  }
}

async function getComms(gameID, sessionID) {
  let comms;
  const key = String(gameID);

  try {
    const { isRecent, data } = await checkCache(key);
    console.log('cache', data)
    // Checks if cache is recent enough to be used
    if (isRecent) {
      comms = data;
      //console.log('Data is up-to-date:', comms, isRecent);


    } 
    else {
      console.log('Data needs processing.');
      comms = await buildGameComms(gameID, sessionID);

      try {
        await updateSecret(key, comms);
        console.log('Secret has been updated.');
      } catch (error) {
        console.error('Failed to update the secret:', error);
      }
    }
  } catch (error) {
    console.error('Error in getComms:', error);
  }
  const inProgressGame = (comms.gameStatusData.game_state & 0b10000010) === 0b10;
  for (let player of comms.playerStatusData) {
    if (player.session_id === sessionID) {
      await playerRules(gameID, inProgressGame, player, comms.gameStatusData);
      break;
    }
  }
  console.log(`Player rules completed`)
  return comms;
}

//deleting old cache needs to be done soon!!
async function buildGameComms (gameID, sessionID) {
  let gsd = await getGame(gameID); // query 1
  console.log(`Game ${gameID}'s gurrent game state: ${gsd.game_state}`);

  if (process.env.ENABLETIMER === 'true') {
    // Calculates how long the game has been running
    const timeSinceStart = Date.now() - Date.parse(gsd.time_started);
    // Ends the game if the duration has passed
    if(timeSinceStart > (gsd.game_duration * 60 * 1000)){
      await updateGamePhase({game_id: gameID, event: 'end_game', operation: 'enable'});
    }
    // Checks if the game is in dead drop phase 1
    if (gsd.game_type === gc.DEAD_DROP && gsd.game_state === '00000011') {
      // Checks if the phase 1 time has passed
      if(timeSinceStart > (gsd.game_config.dropPhase * 60 * 1000)){
        console.log(`Dead drop phase change (from ${gsd.game_state})`);
        // Sets game state to phase 2
        await updateGameState(gameID, '00000100');
        gsd.game_state = '00000111';
        await forceDrops(gameID);
        await exports.createDeadDropAssignments(gameID);
      }
    }
  }

  let ps = await getStatusOfPlayersInGame(gameID); // query 2
  let inProgressGame = (gsd.game_state & 0b10000010) === 0b10;

  if(gsd.game_type === gc.DEAD_DROP){
    if(gsd.game_state === '00000011'){
      if(allPlayersHaveState(ps, '00001111')){
        await updateGameState(gameID,'00000100');
        await exports.createDeadDropAssignments(gameID);
      }
    } else if(gsd.game_state === '00000111'){
      // Puts placed drops in game comms
      gsd.dropData = await getAllDrops(gameID);
      if(allPlayersHaveState(ps, '00111111')){
        await updateGamePhase({game_id: gameID, event: 'end_game', operation: 'enable'});
      }
    }
    if (inProgressGame){
      if (gsd.game_config) { 
        //gsd.cameras = await updateCameras(gameID, gd.game_config.cameraRange.lower, gd.game_config.cameraRange.upper, gd.game_config.cameraDuration.lower, gd.game_config.cameraDuration.upper, gd.game_config.cameraAmount);
      }
    }
  } else if(gsd.game_type === gc.CHASE_THE_RABBIT){
    if(inProgressGame){
      gsd.placed_items = await getPlacedItems(gameID);
    }
  } else if(gsd.game_type === gc.CAPTURE_THE_FLAG) {
    if (inProgressGame) {
      gsd.flags = await getFlags(gameID);
    }
  }

  console.log(`returning game comms`);
  return {
    gameStatusData: gsd,
    playerStatusData: ps
  };
}

async function playerRules(gameID, inProgressGame, PSD, gd) {
  let gt = gd.game_type;
  let player_state = parseInt(PSD.player_state, 2)
  let hasPlayerLeftGame = (player_state & 0b11111011);
  console.log(PSD.session_id, player_state, PSD.hasPlayerLeftGame)
  if (hasPlayerLeftGame === 0b00000000) {
    console.log('Disqualified player calling game comms.')
    return;
  }
  try {
    PSD.inBounds = await checkInBoundary(PSD.session_id, gd.game_bounds) // query 3
    //if not in bounds and game has been started, forces user to leave game (disqualify)
    if (process.env.RULES === 'true') {
      console.log("Rules are enabled. Use .env to disable them.");
      if (!PSD.inBounds && inProgressGame) {
        await exports.leaveGame(PSD.session_id, gameID);
        return;
      }
    }
    if (gt === gc.KING_OF_THE_HILL) {
      if (inProgressGame) {
        console.log(`Creating trails`);
        await createTrail(PSD.session_id, PSD.lat, PSD.long, gameID); // query 4
        await calculateAreaScore(PSD.session_id, gameID); // query 5
      }
    } else if (gt === gc.DEAD_DROP) {
      if (gd.game_state === '00000111' && PSD.player_state === '00011111') {
        const safeZoneDistance = await getDistToSafeZone(gameID, PSD.session_id);
        console.log(`Player ${PSD.session_id} is ${safeZoneDistance} from their safe zone`);
        if (safeZoneDistance < gc.DD_SAFE_DIST_THRESHOLD) {
          console.log(`Player ${PSD.session_id} is safe!`);
          await calculateSafeZoneScore(PSD.session_id, gameID, gc.DD_MAX_SAFE_ZONE_POINTS, gc.DD_SAFE_ZONE_POINT_DECAY);
          await updatePlayerState(gameID, PSD.session_id, '00100000');
        }
      }
      PSD.inventory = await getInventory(PSD.session_id, gameID);
    } else if (inProgressGame && gt === gc.CHASE_THE_RABBIT) {
      const rabbitState = '00001111';
      if (PSD.player_state === rabbitState) {
        console.log(`Player ${PSD.session_id} is a rabbit!`);
        await giveLandmine(gameID, PSD.session_id);
        await checkitemContact(PSD.session_id, gameID, "Trap");
        await randomDropItem(PSD.session_id, gameID, "Pellet")
      } else {
        console.log(`Player ${PSD.session_id} is a fox!`);
        await giveTrap(gameID, PSD.session_id);
        await checkitemContact(PSD.session_id, gameID, "Landmine");
        await checkitemContact(PSD.session_id, gameID, "Pellet");
      }
      PSD.inventory = await getInventory(PSD.session_id, gameID);
    }
  }
  catch (error) {
    console.log("Could not apply rules, as error was found: ", error)
  }
}

exports.getGameComms = async (sessionID, gameID) => {
  console.log("Collecting Game Comms");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  const comms = await getComms(gameID, sessionID);
  // Records the time of request
  recordComms(sessionID,gameID);
  return comms;
}

function allPlayersHaveState(players, state){
  for(let player of players){
    if(player.player_state !== state){
      return false;
    }
  }
  return true;
}

exports.flipReadyPlayerState = async (sessionID, gameID, team) => {
  console.log("Player readying up");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  const currPlayerStatus = await getPlayerStatus(gameID, sessionID);
  console.log("Player's current status in game:",currPlayerStatus);
  let readyState = '00000011';
  if(!currPlayerStatus){
    throw { code: 403, message: 'User is trying to ready up in a game they are not in'};
  } 
  await updatePlayerState(gameID, sessionID, '00000010', team);
  if (readyState == '00000011') {
    const gd = await getGame(gameID)
    if (gd.game_type === 4) {
      await setPlayerZone(sessionID, gameID)
    }
  }
  if (readyState == '00000011' && await this.canStart(gameID)) {
    await StartGame(gameID);
  }
}

async function StartGame (gameID){
  console.log("Starting game " + gameID);
  const game = await getGame(gameID); 
  await updateGamePhase({game_id: gameID, event: "start_game", operation: "enable"});
  await setGameStartTime(gameID);
  await exports.participating(gameID);
  if(game.game_type === gc.CAPTURE_THE_FLAG){
    await newFlags(gameID);
  }
}

async function newFlags(gameID) {
  // get flag starting points
  const teamAFlagPos = await getRandomFlagPos(gameID, 'zoneA');
  const teamBFlagPos = await getRandomFlagPos(gameID, 'zoneB');
  // make flag objects
  await createLocationObject(null, gameID, 'FlagA', teamAFlagPos);
  await createLocationObject(null, gameID, 'FlagB', teamBFlagPos);
}

async function getRandomFlagPos(gameID, zone) {
  const flagLocs = await getFlagLocations(gameID, zone);
  // Randomize!
  return flagLocs[0].geom;
}

async function respawnFlag(gameID, flag){
  const zone = (flag === 'FlagA' ? 'zoneA' : 'zoneB');
  // get random flag pos
  const flagPos = await getRandomFlagPos(gameID, zone);
  // update flag location
  await updateFlagPos(gameID, flag, flagPos);
}

exports.getHistory = async (sessionID) => {
  console.log("Getting game history");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  return await getEndedGames();
}

exports.getHistoryInfo = async (sessionID, gameID) => {
  console.log("Getting game history info");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  return await getEndedGameInfo(gameID);
}

exports.getJoinableGames = async (sessionID) => { //dont pick out old games, call auto-delete
  console.log("Getting Joinable Games");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  await deleteOldCache();
  return await getJoinableGames();
}

exports.createGame = async (sessionID, gameName, type, duration, bounds, config) => {
  console.log("Creating a Game");
  // Checks valid session
  if(!await verifySession(sessionID)){
    throw { code: 403, message: 'Session not found or already ended' };
  }
  const gameID = await makeGame(gameName, type, duration, sessionID, bounds, config);

  // if (type == 2) {
  //   await createCameraPlan(gameID, duration, bounds, config);
  // }
  if (type == 4) {
    await createTeamZones(gameID, bounds)
  }
  return gameID;
}

//creates a point feature json, and sends it in to be put in db.
exports.logCoords = async (data) => {
  try {
    return await insertGeoData(data);
  }
  catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error inserting data', error: error.message})
    };
  }
}


/*
if datetime.now(timezone.utc) - creation_date > timedelta(minutes=1):
            # Schedule deletion
            client.delete_secret(SecretId=secret_id, RecoveryWindowInDays=0)
*/

//gameid-dataname
exports.testingEndpoint = async (event) => {

//return await testingEndpoint(event);
  console.log('Deleting');
  let res = await deleteSecret('lastUpdated')
  await deleteSecrete('okaythisreallyworks')
  //console.log(res)
  const key = 'okaythisreallyworks';
  try {
    const { isRecent, data } = await checkCache(key);

    if (isRecent) {
      console.log('Data is up-to-date:', data);
      
      
    } else {
      console.log('Data needs processing.');
      //processing logic
      const new_value = 'Thank you Dan!!'; // New value to add/update in the secret

      try {
        const {response} = await updateSecret(key, new_value);
        console.log('Secret has been updated.')
      } catch (error) {
        console.error('Failed to update the secret:', error);
      }
    }
  } catch (error) {
    console.error('Error in testingEndpoint:', error);
  }
};

// Checks for if a game can be started
exports.canStart = async (gameID) => {
  console.log('Checking if the game can be started')
  const lobby = await getPlayersInGame(gameID)
  if (lobby.length > 1) { // Ensuring there is at least 2 people in the lobby
    for (let i = 0; i < lobby.length; i++) {
      var ps = parseInt(lobby[i].player_state, 2);
      if ((ps & 0b11) !== 0b11) { // if the two least sig bits aren't 11 then we can't start
        console.log("This player isn't ready", lobby[i].session_id);
        return false;
      }
    }
    console.log("The game can start");
    return true;
  }
  console.log("There isn't enough players");
  console
  return false;
}

// Sets up the participating players for the game
exports.participating = async (gameID) => {
  const players = await getPlayersInGame(gameID);
  const game = await getGame(gameID); 

  const rabbit = Math.floor(Math.random() * players.length);

  for (let i = 0; i < players.length; i++) {
    let newState = '00000100';
    if (game.game_type === gc.DEAD_DROP) {
      await savePlayerLocation(players[i].session_id,gameID);
      await giveNewObject(players[i].session_id, gameID, "Dead Drop");
      console.log("Player", players[i].session_id, "has a dead drop");
    } else if(game.game_type === gc.CHASE_THE_RABBIT){
      if(i === rabbit){
        console.log(`Player ${players[i].session_id} is the starting rabbit`);
        newState = '00001100';
      }
    }
    await updatePlayerState(gameID, players[i].session_id, newState, players[i].team);
    console.log("This player is now participating:", players[i].session_id);
  }
}

async function savePlayerLocation(sessionID,gameID){
  const pos = await getPlayerPosition({session_id:sessionID});
  await createLocationObject(sessionID,gameID,'Player Starting Location',pos.geom);
}

async function forceDrops(gameID){
  const players = await getPlayersInGame(gameID);
  for (let i = 0; i < players.length; i++) {
    try{
      await setDrop(players[i].session_id,gameID, true);
    } catch (err) {
      console.log(`Couldn\'t force drop for player #${players[i].session_id} because:`, err.message);
    }
  }
}

// used to randomize an array
function randomize(array) {
  let newArray = array.slice();
  /* Randomize array in-place using Durstenfeld shuffle algorithm */
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray
}

exports.createDeadDropAssignments = async (gameID) => {
  console.log("Creating Dead Drop Assignments");
  const deadDrops = randomize(await grabDeadDrops(gameID));
  console.log(`Randomized array for drop assignments: ${deadDrops}`);
  let collector = 0;
  let safer = 0;
  if(deadDrops.length > 2){
    for (let i = 0; i < deadDrops.length; i++) {
      let ci = i - 1;
      let si = i + 1;
      if(i === 0){
        ci = deadDrops.length - 1;
      } else if(i === deadDrops.length - 1){
        si = 0;
      }
      collector = deadDrops[ci].session_id;
      safer = deadDrops[si].session_id;
      console.log(`Assigning drop placed by:${deadDrops[i].session_id} to be collected by:${collector} and `)
      await assignDrop(gameID,deadDrops[i].session_id, collector, safer);
    }
  } else {
    await assignDrop(gameID,deadDrops[0].session_id, deadDrops[1].session_id, deadDrops[0].session_id);
    await assignDrop(gameID,deadDrops[1].session_id, deadDrops[0].session_id, deadDrops[1].session_id);
  }
}

