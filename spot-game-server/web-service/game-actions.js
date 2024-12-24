const { getPlayerPosition, getPlayerDropObj, updateObjPos, removeFromInventory, getStartLocation, increasePlayerScore, getPlayerRecentMovement, getNearestPlayer, calculateSafeZoneScore, updatePlayerState, getAssignedCollectObj, putInInventory, updateObjState, getTimeOfLastGivenObject, getInventory, giveNewObject, getNearestItem, getItemFromInventory, createLocationObject, clearInventory, getPlacedItems, updateObjTime, getPelletsInInventories, getTimeOfLastDroppedObject, getUsername, getPlayerStatus, checkInZone, getTeam, getNearestOpposingPlayer } = require("./data-access");
const { GameConsts: gc, GameConsts } = require("./game-const");

exports.placeItem = async (sessionID, gameID, itemType) => {
    console.log(`Placing item '${itemType}' for player ${sessionID} in game ${gameID}`);
    if(!itemType) {throw {code: 400, message: `No item given for placing`}}; 
    // Gets the player's current position
    const pos = await getPlayerPosition({session_id:sessionID});
    if(!pos) {throw {code: 400, message: `No position data for player ${sessionID}`}};
    // Gets the player's drop object from the inventory storage
    const item = await getItemFromInventory(gameID, sessionID, itemType);
    if(!item) {throw {code: 400, message: `No item '${itemType}' found in player ${sessionID}'s inventory`}};
    // Sets the drop object at the player's position
    await updateObjPos(sessionID, item.object_id, pos.geom);
    // Removes the object from inventory storage
    await removeFromInventory(sessionID, item.object_id);
}
//used for dropping pellets
exports.dropNonInventoryItem = async (sessionID, gameID, itemType) => {
    console.log(`Dropping item '${itemType}' for player ${sessionID} in game ${gameID}`);
    if(!itemType) {throw {code: 400, message: `No item given for placing`}};
    const pos = await getPlayerPosition({session_id:sessionID});
    await createLocationObject(sessionID, gameID, itemType, pos.geom)
    if(!pos) {throw {code: 400, message: `No position data for player ${sessionID}`}};
}

exports.giveLandmine = async (gameID, sessionID) => {
    const logTimeString = await getTimeOfLastGivenObject(gameID, 'Landmine', sessionID);
    const logTimeMs = (new Date(logTimeString)).getTime()
    const timeSinceGiven = (Date.now() - (logTimeMs));
    console.log(`Al Rabbit se dió un landmine hace: ${timeSinceGiven} milisegundos`);

    if (timeSinceGiven > (gc.CR_GAIN_LANDMINE_INTERVAL * 1000)) {
        const rabbitInventory = await getInventory(sessionID, gameID);
        // Checks if the rabbit's inventory is full
        if (rabbitInventory.length < gc.CR_RABBIT_INVENTORY_CAPACITY) {
            await giveNewObject(sessionID, gameID, 'Landmine');
            console.log('landmine given to player', sessionID);
        } else {
            // Updates the log time of the most recent item to reset the clock (timeSinceGiven)
            await updateObjTime(sessionID);
        }
    }
}

exports.giveTrap = async (gameID, sessionID) => {
    const logTimeString = await getTimeOfLastGivenObject(gameID, 'Trap', sessionID);
    const logTimeMs = (new Date(logTimeString)).getTime()
    const timeSinceGiven = (Date.now() - (logTimeMs));
    console.log(`A los Foxes se dió un trap hace: ${timeSinceGiven} milisegundos`);

    if (timeSinceGiven > (gc.CR_GAIN_TRAP_INTERVAL * 1000)) {
        const foxInventory = await getInventory(sessionID, gameID);
        const traps = foxInventory.filter((item) => item.object_type === 'Trap');
        // Checks if the fox's inventory is full
        if (traps.length < gc.CR_FOX_INVENTORY_CAPACITY) {
            await giveNewObject(sessionID, gameID, 'Trap');
            console.log('trap given to player', sessionID);
        } else {
            // Updates the log time of the most recent item to reset the clock (timeSinceGiven)
            await updateObjTime(sessionID);
        }
    }
}

exports.setDrop = async (sessionID, gameID, isForced) => {
    // Checks if the player has moved farther than the defined distance in the defined time
    const movementDist = getPlayerRecentMovement(sessionID, gc.DD_DROP_DELAY);
    if(movementDist > gc.DD_MOVEMENT_THRESHOLD) {throw {code: 403, message:`Pickup canceled due to excessive movement: ${movementDist}`}}
    console.log(`Saving drop info for session ${sessionID} in game ${gameID}`);
    // Gets the player's current position
    const pos = await getPlayerPosition({session_id:sessionID});
    if(!pos) {throw {code: 400, message: `No position data for player ${sessionID}`}};
    // Gets the player's drop object from the inventory storage
    const drop = await getPlayerDropObj(sessionID);
    if(!drop) {throw {code: 400, message: `No drop found for player ${sessionID}`}};

    // Checks are done, continuing with function
    console.log(`Saving drop info for session ${sessionID} in game ${gameID}`);
    // Updates player state
    await updatePlayerState(gameID, sessionID, '00001000');
    // Sets the drop object at the player's position
    await updateObjPos(sessionID, drop.object_id, pos.geom);
    // Removes the object from inventory storage
    await removeFromInventory(sessionID, drop.object_id);
    // Calculates score and rewards player
    if(!isForced){
        const score = await calculateDropScore(sessionID, gameID, pos);
        await increasePlayerScore(gameID, sessionID, score);
    } else {
        await increasePlayerScore(gameID, sessionID, gc.DD_NO_DROP_PENALTY);
    }
}

async function calculateDropScore(sessID, gameID, dropPos){
    // Grabs the player's starting location
    const startPos = await getStartLocation(sessID, gameID);
    console.log(`Starting lat:${startPos.lat}, long:${startPos.long}\nEnding lat:${dropPos.lat}, long:${dropPos.long}`);
    // Calculates the distance traveled and converts it to points
    const startDist = Math.sqrt((startPos.lat - dropPos.lat)**2 + (startPos.long - dropPos.long)**2);
    console.log(`Distance from start:${startDist}`);
    const startScore = Math.floor(gc.DD_DIST_TO_SCORE_MULTIPLIER * startDist);
    // Calculates the distance to the nearest player and converts it to points
    const playerDist = 0 //(await getNearestPlayer(sessID,gameID,dropPos.geom)).distance;
    console.log(`Distance to nearest player:${playerDist}`);
    const hermitScore = Math.floor(gc.DD_DIST_TO_SCORE_MULTIPLIER * playerDist);
    // Calculates the final score
    let finalScore = startScore + hermitScore;
    return finalScore;
}

exports.pickupDrop = async (sessionID, gameID) => {
    // Gets the player's current position
    const pos = await getPlayerPosition({session_id:sessionID});
    if(!pos) {throw {code: 400, message: `No position data for player ${sessionID}`}};
    // Gets assigned collection point
    const drop = await getAssignedCollectObj(sessionID);
    if(!drop) {throw {code: 400, message: `No drop found for player ${sessionID}`}};
    // Checks if player is in range of collection point
    const distance = Math.sqrt((pos.lat - drop.lat)**2 + (pos.long - drop.long)**2);
    if(distance > gc.DD_PICKUP_DIST_THRESHOLD) {throw {code: 400, message: `Player is too far from assigned collection point: ${distance}`}}
    // Checks if the player has moved farther than the defined distance in the defined time
    const movementDist = getPlayerRecentMovement(sessionID, gc.DD_COLLECT_DELAY);
    if(movementDist > gc.DD_MOVEMENT_THRESHOLD) {throw {code: 403, message:`Pickup canceled due to excessive movement: ${movementDist}`}}

    // Checks are done, continuing with function
    console.log(`Saving pickup info for session ${sessionID} in game ${gameID}`);
    // Puts collected drop into player's inventory
    await putInInventory(sessionID, gameID, drop.object_id);
    // Marks drop as collected
    await updateObjState(drop.object_id, '00000010');
    // Changes player state to allow them to score at safe point
    await updatePlayerState(gameID, sessionID, '00010000');
}

exports.checkitemContact = async (sessionID, gameID, itemType) => { 
    // Finds the closest item of a given type
    const nearestItem = await getNearestItem(gameID, sessionID, itemType);
    if(!nearestItem) { return; }
    console.log(`This is the nearest item:`,nearestItem);
    const distance = nearestItem.distance;

    if (itemType === "Landmine") {
        if (distance < gc.CR_LANDMINE_TOUCH_DIST){
            // Sets the state of the object to 'used'
            await updateObjState(nearestItem.obj_id, '10000000');
            // Removes the object's position
            await updateObjPos(sessionID, nearestItem.obj_id, null);
            await increasePlayerScore(gameID, sessionID, -gc.CR_LANDMINE_SCORE_PENALTY);
        }
    } else if (itemType === "Trap") {
        if (distance < gc.CR_TRAP_TOUCH_DIST){
            // Sets the state of the object to 'used'
            await updateObjState(nearestItem.obj_id, '10000000');
            // Removes the object's position
            await updateObjPos(sessionID, nearestItem.obj_id, null);
            await increasePlayerScore (gameID, nearestItem.owner_session_id, gc.CR_CAPTURE_BONUS);
            // Doubles pellet score of all foxes who picked up pellets and removes them from their inventory
            await convertPelletsToPoints(gameID);
            // Makes the rabbit a fox, and the capturing fox a rabit
            await swapRoles(gameID, sessionID, nearestItem.owner_session_id);
            // Removes all traps, pellets, and landmines from the map
            await clearPlacedItems(nearestItem.owner_session_id, gameID);
        }
    } else if (itemType === "Pellet") {
        if (distance < gc.CR_PELLET_TOUCH_DIST){
            // Removes the object's position
            await updateObjPos(nearestItem.owner_session_id, nearestItem.obj_id, null);
            await putInInventory(sessionID, gameID, nearestItem.obj_id);
            await increasePlayerScore (gameID, sessionID, gc.CR_POINT_PELLET_COLLECT_VALUE);
        }
    } else {
        throw {code: 400, message: `Item type ${itemType} not recognized in checkitemContact`};
    }
}

async function convertPelletsToPoints(gameID){
    const pellets = await getPelletsInInventories(gameID);
    console.log(`Found pellets:`,pellets);
    for(let pellet of pellets){
        await increasePlayerScore(gameID, pellet.session_id, gc.CR_POINT_PELLET_COLLECT_VALUE);
        await removeFromInventory(pellet.session_id, pellet.object_id);
    }
}

async function swapRoles(gameID, rabbitID, foxID){
    await clearInventory(rabbitID);
    await clearInventory(foxID);
    // Toggles the bit that dictates being the rabbit for both players
    await updatePlayerState(gameID, rabbitID, '00001000');
    await updatePlayerState(gameID, foxID, '00001000');
}

async function clearPlacedItems(sessionID, gameID){
    const items = await getPlacedItems(gameID);
    for(let item of items){
        // Sets the state of the object to 'used'
        await updateObjState(item.object_id, '10000000');
        // Removes the object's position
        await updateObjPos(sessionID, item.object_id, null);
    }
}

//Items using this function are dropped by chance, rather than time.
exports.randomDropItem = async (sessionID, gameID, itemType) => {
    let maxPossible;
    if (itemType === "Pellet") {
        maxPossible = gc.CR_PELLET_DROP_PROB;
    }
    else {
        console.log("Using default randomness");
        maxPossible = 10;
    }
    const time = await getTimeOfLastDroppedObject(gameID, itemType, sessionID);
    
    if (!(time === 0)) {
        console.log(Date.now())
        console.log(time)
        const logTimeMs = (new Date(time)).getTime()
        const timeDiffs = ((Date.now() - (logTimeMs))/1000);
        if (itemType === "Pellet") {
            if (timeDiffs > gc.CR_POINT_PELLET_INTERVAL ) {
                await increasePlayerScore(gameID, sessionID, gc.CR_POINT_PELLET_DROP_VALUE);
                return await this.dropNonInventoryItem(sessionID, gameID, itemType);
            }
        }
    }
    else {
        if (itemType === "Pellet") {
            await increasePlayerScore(gameID, sessionID, gc.CR_POINT_PELLET_DROP_VALUE);
            return await this.dropNonInventoryItem(sessionID, gameID, itemType)
        }
    }
    const randomNumber = Math.floor(Math.random() * maxPossible)
    if (randomNumber === 0) {
        if (itemType === "Pellet") {
            console.log('Randomly dropping pellet!')
            await increasePlayerScore(gameID, sessionID, gc.CR_POINT_PELLET_DROP_VALUE);
            return await this.dropNonInventoryItem(sessionID, gameID, itemType)
        }
    }
}

// Tagging function
exports.tag = async (sessionID, gameID) => {
    console.log('Player', sessionID, 'is trying to tag someone');
    const sessionJSON = {
        session_id: sessionID
    }

    const inZone = await checkInZone(sessionID, gameID);
    if (!inZone) {
        return "Not In Zone";
    }

    const myPosition = await getPlayerPosition(sessionJSON);
    const team = await getTeam(sessionID);
    const nearestPlayer = await getNearestOpposingPlayer(sessionID, gameID, myPosition.geom, team);
    if (nearestPlayer.distance <= GameConsts.CF_TAG_DIST) { // Should also call function to check if the user is in their zone
        // Check whether the user being tagged has a flag
        const ps = await getPlayerStatus(gameID, nearestPlayer.session_id);
        const state = parseInt(ps.player_state, 2);
        if ((state & 0b00001000) !== 0b00001000) { // Checking if the player is tagged already (need to also check if they are in the right zone)
            if ((state & 0b00010000) === 0b00010000) { // Checking if the player has a flag
                await clearInventory(nearestPlayer.session_id);
            }
            await updatePlayerState(gameID, nearestPlayer.session_id, '00001000');
            const username = await getUsername(nearestPlayer.session_id);
            console.log('Player', sessionID, 'just tagged player', ps.session_id);
            return "You tagged " + username;
        }
        console.log(ps.session_id, 'has already been tagged');
        return "This player has already been tagged";
    }
    console.log(nearestPlayer.session_id, 'is not in range to be tagged');
    return "Not In Range";
}