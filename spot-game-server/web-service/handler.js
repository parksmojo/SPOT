/* 
    This file:
        - Holds all of the endpoints 
        - Does basic input and error handling
        - Calls the respective services
*/

"use strict";
const { getInventory } = require("./data-access");
const { setDrop, pickupDrop, placeItem, tag } = require("./game-actions");
const { login, logout, getJoinableGames, createGame, getGameComms, logGPS, testingEndpoint, joinGame, leaveGame, flipReadyPlayerState, logCoords, getHistory, getHistoryInfo } = require("./services");

exports.hello = async (event) => {
  return {
    // This is a test
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Go Serverless v2.0! Your function executed successfully!",
        input: event,
      },
      null,
      2
    ),
  };
};

exports.login = async (req) => {
  console.log("Login endpoint hit!\nRequest Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.username || !data.username.trim()) {
      throw { code: 406, message: 'No username provided' };
    } else if (data.username.length > 18) {
      throw { code: 406, message: 'Username too long' };
    }
    if (!data.deviceID || !data.username.trim()) {
      throw { code: 406, message: 'No device id provided' };
    } else if (data.deviceID.length > 18) {
      throw { code: 406, message: 'Device id too long' };
    }
    // Calls login service
    res.body.sessionID = await login(data.username, data.deviceID);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}
exports.logout = async (req) => {
  console.log("Logout endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if session token is missing
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    // Calls logout service
    await logout(data.sessionID);
    res.body.message = "Successfully logged out user";
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.joinGame = async (req) => {
  console.log("Join Game endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }
    res.body.gameData = await joinGame(data.sessionID, data.gameID);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.leaveGame = async (req) => {
  console.log("Leave Game endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }
    await leaveGame(data.sessionID, data.gameID);
    res.body.message = "Player successfully left game";
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.gameComms = async (req) => {
  console.log("Game Comms endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }


    res.body.gameComms = await getGameComms(data.sessionID, data.gameID);
    console.log(res.body.gameComms.playerStatusData)
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  // console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.action = async (req) => {
  console.log("Action endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }
    if (!data.actionData) {
      throw { code: 406, message: 'Missing action data' };
    }
    // Direct request to the correct service
    switch (data.actionData.type) {
      case "Ready":
        await flipReadyPlayerState(data.sessionID, data.gameID, data.actionData.team);
        break;
      case "Drop":
        await setDrop(data.sessionID, data.gameID, false);
        break;
      case "Collect":
        await pickupDrop(data.sessionID, data.gameID);
        break;
      case "Place":
        await placeItem(data.sessionID, data.gameID, data.actionData.item);
        break;
      case "Tag":
        res.body.tagged = await tag(data.sessionID, data.gameID);
        break;
      default:
        throw { code: 406, message: 'Bad request. Action type not understood' };
    }
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.getJoinableGames = async (req) => {
  console.log("List Games endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if session token is missing
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    res.body.gameList = await getJoinableGames(data.sessionID);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.createNewGame = async (req) => {
  console.log("Create Game endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request is missing data
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameName) {
      throw { code: 406, message: 'Missing game name' };
    }
    if (!data.type) {
      throw { code: 406, message: 'Missing game type' };
    }
    if (!data.duration) {
      throw { code: 406, message: 'Missing game duration' };
    }
    if (!data.bounds) {
      throw { code: 406, message: 'Missing game bounds' };
    }
    res.body.gameID = await createGame(data.sessionID, data.gameName, data.type, data.duration, data.bounds, data.config);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.gameHistory = async (req) => {
  console.log("Game History endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if session token is missing
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    res.body.gameList = await getHistory(data.sessionID);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.gameHistoryInfo = async (req) => {
  console.log("Game History endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request info is missing
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }
    res.body.gameList = await getHistoryInfo(data.sessionID, data.gameID);
    res.code = 200;
  } catch (error) {
    console.error(error);
    res.code = error.code;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body)
  };
}

exports.logGPS = async (req) => {
  console.log("GPS endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  let res = { code: 500, body: {} };
  const data = JSON.parse(req.body);
  try {
    await logCoords(data);
    res.code = 200;
  }
  catch (error) {
    console.error(error);
    res.code = error.code || 500;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body),
  };
}

exports.testingEndpoint = async (event) => {
  return await testingEndpoint(event);
}

exports.inventory = async (req) => {
  console.log("Inventory endpoint hit! \n Request Body:", req.body);
  if (req.isBase64Encoded) {
    req.body = atob(req.body);
    console.log("Body Decoded:", req.body);
  }
  const data = JSON.parse(req.body);
  let res = { code: 500, body: {} };
  try {
    // Throws error if request info is missing
    if (!data.sessionID) {
      throw { code: 406, message: 'Missing session ID' };
    }
    if (!data.gameID) {
      throw { code: 406, message: 'Missing game ID' };
    }
    res.body.inventory = await getInventory(data.sessionID, data.gameID);
    res.code = 200;
  }
  catch (error) {
    console.error(error);
    res.code = error.code || 500;
    res.body.message = 'Error: ' + error.message;
  }
  console.log("Returning: ", res.body);
  return {
    statusCode: res.code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(res.body),
  };
}