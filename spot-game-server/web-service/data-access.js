/*
    This file:
        - Has functions for interacting with the database.
*/
const pg = require('pg');
const { Pool } = pg;
const pool = new Pool({
    user: process.env.USERNAME,
    password: process.env.PASSWORD,
    host: process.env.HOST,
    port: process.env.PORT,
    database: process.env.DATABASE,
    idleTimeoutMillis: 20000
});
const { GameConsts: gc } = require('./game-const');

exports.getActiveSessions = async () => {
    console.log("Getting Active Sessions");
    const query = {
        text: 'SELECT * FROM app_data.session_data WHERE log_out_time IS NULL;'
    }
    const res = await pool.query(query);
    return res.rows;
}

exports.startSession = async (username, deviceID) => {
    console.log("Starting new session");
    const query = {
        text: 'INSERT INTO app_data.session_data (username, device_id) VALUES ($1, $2) RETURNING *;',
        values: [username, deviceID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.endSession = async (sessionID) => {
    console.log("Ending session:", sessionID);
    const query = {
        text: `UPDATE app_data.session_data SET log_out_time = NOW() WHERE session_id = $1 AND log_out_time IS NULL RETURNING *;`,
        values: [sessionID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.getSession = async (sessionID) => {
    console.log("Finding session:", sessionID);
    const query = {
        text: `SELECT * FROM app_data.session_data WHERE session_id = $1 AND log_out_time IS NULL;`,
        values: [sessionID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

// Finds a specific game by ID
exports.getGame = async (gameID) => {
    console.log("Selecting game #", gameID);
    const query = {
        text: `
            SELECT gd.*, gsl.*
            FROM app_data.game_data AS gd
            JOIN app_data.game_status_log AS gsl ON gd.game_id = gsl.game_id
            WHERE gd.game_id = $1
            ORDER BY log_time DESC LIMIT 1;
        `,
        values: [gameID],
    }
    
    const res = await pool.query(query);
    //grabs most recent set of data
    //console.log(res.rows[res.rows.length - 1])
    return res.rows[0];
}
//returns a list of games in lobby
exports.checkJoinableGame = async (gameID) => {
    console.log("Checking joinable state of game",gameID);
    const query = {
        text: `SELECT * FROM (
            SELECT * FROM app_data.game_status_log 
            WHERE game_id = $1 
            ORDER BY log_time DESC LIMIT 1
            ) WHERE (game_state & B'10000011') = B'00000001';`,
        values: [gameID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.joinedPlayerState = async (gameID, sessionID) => {
    console.log("Adding player", sessionID, "to game", gameID);
    const query = {
        text: `INSERT INTO app_data.player_state_data (game_id, session_id, player_state, score)
            VALUES ($1, $2, $3, 0) RETURNING *`,
        values: [gameID, sessionID, '00000001'],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.setLeftGamePlayerState = async (gameID, sessionID) => {
    console.log("Removing player status", sessionID, "from game", gameID);
    const query = {
        text: `INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
            SELECT game_id, session_id, team, player_state & B'00000100', score, config
            FROM app_data.player_state_data WHERE session_id = $2 AND game_id = $1 ORDER BY log_time DESC LIMIT 1
            RETURNING *;`,
        values: [gameID, sessionID],
    }
    const res = await pool.query(query);
    return res.rows[0];
}


exports.updatePlayerState = async (gameID, sessionID, bitToFlip, team) => {
    console.log("Updating bit", bitToFlip, "for player", sessionID, "in game", gameID);
    let query = {};
    if (team) {
        query = {
            text: `INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
            SELECT game_id, session_id, $4, player_state # $3, score, config
            FROM app_data.player_state_data 
            WHERE session_id = $2 AND game_id = $1 
            ORDER BY log_time DESC LIMIT 1
            RETURNING *;`,
            values: [gameID, sessionID, bitToFlip, team],
        }
    } else {
        query = {
            text: `INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
            SELECT game_id, session_id, team, player_state # $3, score, config
            FROM app_data.player_state_data 
            WHERE session_id = $2 AND game_id = $1 
            ORDER BY log_time DESC LIMIT 1
            RETURNING *;`,
            values: [gameID, sessionID, bitToFlip],
        }
    }
    const res = await pool.query(query);
    return res.rows[0];
}

//This should also check if player is in bounds, and accordingly force them to leave the game if so. 
exports.getPlayerStatus = async (gameID, sessionID) => {
    console.log("Getting status of player", sessionID, "in game", gameID);
    const query = {
        text: `SELECT * FROM app_data.player_state_data 
            WHERE session_id = $2 AND game_id = $1 ORDER BY log_time DESC LIMIT 1`,
        values: [gameID, sessionID],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

// Gets the status of all the players who have been in the game since it began
exports.getStatusOfPlayersInGame = async (gameID) => {
    console.log("Getting player status data for game:", gameID);
    const query = {
        text: `
        WITH latest_geo_data AS (
            SELECT g.device_id, g.lat, g.long, g.log_time AS geo_log_time
            FROM app_data.geo_data g
            JOIN (
                SELECT device_id, MAX(log_time) AS latest_log_time
                FROM app_data.geo_data
                GROUP BY device_id
            ) lg ON g.device_id = lg.device_id AND g.log_time = lg.latest_log_time
        ),
        latest_comms_log AS (
            SELECT session_id, MAX(log_time) AS comms_log_time
            FROM app_data.comms_log
            GROUP BY session_id
        ),
        session_info AS (
            SELECT DISTINCT ON (session_data.session_id)
                session_data.session_id, session_data.username, player_state_data.player_state, player_state_data.team, player_state_data.score, 
                player_state_data.log_time, latest_geo_data.lat, latest_geo_data.long, 
                EXTRACT(EPOCH FROM AGE(NOW(),latest_geo_data.geo_log_time))*1000 AS time_since_geo_log, EXTRACT(EPOCH FROM AGE(NOW(),latest_comms_log.comms_log_time))*1000 AS time_since_comms_log
            FROM app_data.session_data
            JOIN app_data.player_state_data ON player_state_data.session_id = session_data.session_id
            JOIN latest_geo_data ON latest_geo_data.device_id = session_data.device_id
            JOIN latest_comms_log ON latest_comms_log.session_id = session_data.session_id
            WHERE player_state_data.game_id = $1
            ORDER BY session_data.session_id, player_state_data.log_time DESC
        )
        SELECT si.session_id, si.username, si.player_state, si.team, si.score, si.lat, si.long, si.time_since_geo_log, si.time_since_comms_log
        FROM session_info si
        WHERE (si.player_state & B'00000101')::integer != 0;
        `,
        values: [gameID]
    };
    const res = await pool.query(query);
    return res.rows;
}

exports.getActivePlayers = async(gameID) => {
    const query = {
        text: `
            WITH LatestLog AS (
                SELECT 
                    psd.*,
                    ROW_NUMBER() OVER (PARTITION BY psd.session_id ORDER BY psd.log_time DESC) AS rn
                FROM 
                    app_data.player_state_data psd
            ),
            ActivePlayers AS (
                SELECT *
                FROM LatestLog ll
                WHERE rn = 1 AND game_id = $1
                AND ll.player_state & B'00000101' = B'00000101'
            )
            SELECT * FROM ActivePlayers
        `,
        values: [gameID]
    }
    const res = await pool.query(query);
    return res.rows;
}
exports.getGameStatus = async (gameID) => {
    const gameData = await exports.getGame(gameID)
    return await gameData.game_state;
}

exports.recordComms = async(sessionID, gameID) => {
    console.log("Recording the comm time of session:", sessionID, "in game:", gameID);
    const query = {
        text: 'INSERT INTO app_data.comms_log (session_id, game_id) VALUES ($1, $2) RETURNING *;',
        values: [sessionID,gameID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.logoutInactivePlayers = async() => {
    const query = {
        text: `UPDATE app_data.session_data
            SET log_out_time = NOW()
            WHERE log_out_time IS NULL
            AND log_in_time < NOW() - INTERVAL '${gc.SESSION_CLEANUP_THRESHOLD}'
            AND NOT EXISTS (
                SELECT 1
                FROM app_data.player_state_data psd
                WHERE psd.session_id = app_data.session_data.session_id
                    AND psd.log_time > NOW() - INTERVAL '${gc.SESSION_CLEANUP_THRESHOLD}'
            )
            RETURNING *;`
    }
    const res = await pool.query(query);
    if(res.rows.length !== 0){
        console.log("Logging out inactive users");
    } 
}

// Gets all running games, does NOT work as of now. need to think abt how to use bitwise.
exports.getRunningGames = async () => {
    console.log("Getting running games from DB");
    const query = {
        text: `WITH LatestLog AS (
            SELECT
                game_id,
                game_state,
                status_config,
                log_time,
                ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY log_time DESC) AS rn
            FROM app_data.game_status_log
        )
        SELECT gd.*, ll.*
        FROM app_data.game_data AS gd
        JOIN LatestLog AS ll ON gd.game_id = ll.game_id 
        WHERE ll.rn = 1 AND
          (game_state::BIT(8) & B'00000010'::BIT(8)) = B'00000010'::BIT(8) AND
          (game_state::BIT(8) & B'10000000'::BIT(8)) = B'00000000'::BIT(8)`,
    }
    const res = await pool.query(query);
    //console.log(res.rows)
    return res.rows;
}

// Retrieves list of games which are in lobby.
exports.getJoinableGames = async () => {
    //read documentation.txt to understand gameStatus
    const query = `
    WITH LatestLog AS (
        SELECT
            game_id,
            game_state,
            status_config,
            log_time,
            ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY log_time DESC) AS rn
        FROM app_data.game_status_log
    )
    SELECT gd.*, ll.game_state, ll.status_config, ll.log_time, sd.username AS creator
    FROM app_data.game_data AS gd
    JOIN LatestLog AS ll ON gd.game_id = ll.game_id
    JOIN app_data.session_data AS sd ON gd.created_by = sd.session_id
    WHERE ll.rn = 1 AND (ll.game_state & B'10000011') = B'00000001';
    `;
    const res = await pool.query(query);
    return res.rows
}

exports.getEndedGames = async () => {
    const query = `WITH RecentGameStatus AS (
            SELECT gsl.game_id, gsl.game_state, ROW_NUMBER() OVER (PARTITION BY gsl.game_id ORDER BY gsl.log_time DESC) as row_num
            FROM app_data.game_status_log gsl
        )
        SELECT gd.*
        FROM app_data.game_data gd
        JOIN RecentGameStatus rgs ON gd.game_id = rgs.game_id
        WHERE rgs.row_num = 1 AND rgs.game_state & B'10000011' = B'10000011'`;
    const res = await pool.query(query);
    return res.rows
}

exports.getEndedGameInfo = async (gameID) => {
    console.log("Getting history info for game", gameID)
    const query = {
        text: `WITH RecentPlayerState AS (
                SELECT psd.player_state_id, psd.game_id, psd.session_id, psd.player_state, psd.score, psd.team, psd.log_time,
                    ROW_NUMBER() OVER (PARTITION BY psd.session_id ORDER BY psd.log_time DESC) as row_num
                FROM app_data.player_state_data psd
                WHERE psd.game_id = $1 AND (psd.player_state & B'00000100') = B'00000100'
            )
            SELECT rps.player_state_id, rps.game_id, rps.session_id, rps.player_state, rps.score, rps.team, rps.log_time, sd.username
            FROM RecentPlayerState rps
            JOIN app_data.session_data sd ON rps.session_id = sd.session_id
            WHERE rps.row_num = 1;`,
        values: [gameID]
    };
    const res = await pool.query(query);
    return res.rows;
}

// Creates game
exports.makeGame = async (gameName, type, duration, sessionID, bounds, config) => {
    const query = {
        text: `
            WITH cte (game_id) AS (
                INSERT INTO app_data.game_data (game_name, game_type, game_duration, created_by, game_config, game_bounds)
                VALUES ($1, $2, $3, $5, $6, $7) RETURNING game_id
            )
            INSERT INTO app_data.game_status_log (game_id, game_state)
            VALUES ((SELECT cte.game_id FROM cte), $4) RETURNING *;`,
        values: [gameName, type, duration, '00000001', sessionID, config, bounds]
    };
    const insertResult = await pool.query(query);
    await exports.cleanupGames();
    if (type === 2) {
        await exports.setupCameras(insertResult.rows[0].game_id, bounds);
    }
    return insertResult.rows[0].game_id;
};

// inserts game updates to the db
exports.updateGame = async (data) => {
    const binaryStatus = data.game_state.toString(2).padStart(8, '0'); //$1::BIT(8)
    const query = `
        INSERT INTO App_Data.game_status_log (game_id, game_state, status_config)
        VALUES ($1, $2, $3)
        RETURNING game_id;
    `;
    VALUES = [data.game_id, binaryStatus, data.status_config]
    await pool.query(query, VALUES);
}

//given an enabled/disabled event, updates game status accordingly via gameState_map.
exports.updateGamePhase = async(data) => {
    const gameData = await exports.getGame(data["game_id"]);
    //add other events to map, where value is [enabled_bit, disabled_bit] in map
    const gameState_map = new Map([["in_lobby", [0b00000001, 0b11111110]], ["start_game", [0b00000010, 0b11111101]], ["end_game", [0b10000000, 0b01111111]]])
    console.log(gameData['game_state'])
    //accordingly update bit based on operation enable/disable
    let binaryValue = parseInt(gameData['game_state'], 2);
    if (data["operation"].localeCompare("enable") == 0) {
        binaryValue |= gameState_map.get(data.event)[0];
    }
    else if (data["operation"].localeCompare("disable") == 0) {
        binaryValue &= gameState_map.get(data.event)[1];
    }
    //console.log(binaryValue.toString(2).padStart(8, '0'))
    gameData['game_state'] = binaryValue; //.toString(2).padStart(8, '0')
    await exports.updateGame(gameData);
};

// Update the Game State using the bit given
exports.updateGameState = async (gameID, bitToFlip) => {
    console.log("Updating bit", bitToFlip, "for game", gameID);
    const query = {
        text: `INSERT INTO app_data.game_status_log (game_id, game_state, status_config)
        SELECT game_id, game_state # $1, status_config
        FROM app_data.game_status_log 
        WHERE game_id = $2
        ORDER BY log_time DESC LIMIT 1
        RETURNING *;`,
        values: [bitToFlip, gameID],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.setGameStartTime = async (gameID) => {
    console.log("Setting game start time for game",gameID);
    const query = `UPDATE app_data.game_data SET time_started = NOW() WHERE game_id = $1 AND time_started IS NULL;`
    const res = await pool.query(query, [gameID]);
    return res.rows[0];
}

exports.insertGeoData = async (data) => {
    const profile = data.prof;
    console.log('Inserting data for this profile', data.prof)
    const long = parseFloat(data.long)
    const lat =  parseFloat(data.lat)
    const geometry = {
        type: "Point",
        coordinates: [long, lat]
    };
    const VALUES = [profile, JSON.stringify(geometry), parseFloat(data.acc), data.time, lat, long, parseFloat(data.spd)];
    
    const query = `
    INSERT INTO App_Data.geo_Data (device_id, geom, accuracy, log_time, lat, long, speed)
    VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4, $5, $6, $7)
    `;
    
    await pool.query(query, VALUES);
    //return await exports.checkInBoundary(profile)
};

// given device id, returns point geometry, lat, long 
//link this with checkInBoundary
//to be done later: check for accuracy.
exports.getPlayerPosition = async (data) => {
    console.log('getting player position',data.session_id);
    const query = `
    SELECT gd.geom, gd.lat, gd.long
    FROM app_data.geo_data AS gd
    JOIN app_data.session_data AS sd ON sd.device_id = gd.device_id
    WHERE sd.session_id = $1
    ORDER BY gd.log_time DESC
    LIMIT 1;
    `;
    const res = await pool.query(query, [data.session_id])

    return res.rows[0];
}
//right now this is using session id instead of device, will change later.
//given device id, checks if player is in boundary, and if not, should notify another method to update db.
//update: this should be called on by gameComms, and given sessionID it checks if player is in bounds.
exports.checkInBoundary = async (sessionID, bounds) => {
    console.log(`checking if player ${sessionID} is in area ${bounds}`);
    const query = {
        text: ` WITH latest_point AS (
                SELECT gd.geom, gd.lat, gd.long, sd.session_id
                FROM app_data.geo_data AS gd
                JOIN app_data.session_data AS sd ON sd.device_id = gd.device_id
                WHERE sd.session_id = $1
                ORDER BY gd.log_time DESC
                LIMIT 1
            )
            SELECT ST_Contains(r.buffer_geom, lp.geom) AS is_inside
            FROM app_data.rules_data r, latest_point lp
            WHERE r.rule_name = $2; `,
        values: [sessionID, bounds]
    };
    try {
        const res = await pool.query(query);
        if (res.rows.length > 0) {
            console.log(res.rows[0]);
            return res.rows[0].is_inside;
        } else {
            console.log('No data found for the given session ID.');
            return false;
        }
    } catch (err) {
        console.error('Error executing query:', err);
        //throw err;
        return true;
    }
}   

exports.checkInZone = async(sessionID, gameID) => {
    const query = {
        text: ` 
            WITH latest_point AS (
                SELECT gd.geom, gd.lat, gd.long, sd.session_id
                FROM app_data.geo_data AS gd
                JOIN app_data.session_data AS sd ON sd.device_id = gd.device_id
                WHERE sd.session_id = $1
                ORDER BY gd.log_time DESC
                LIMIT 1
            ),
            playerZone AS (
                SELECT object_position FROM app_data.object_status os
                JOIN app_data.object_data od ON os.object_id = od.object_id
                WHERE os.session_id = $1 AND od.game_id = $2 AND (od.object_type = 'Zone A' OR od.object_type = 'Zone B')
                ORDER BY log_time DESC
                LIMIT 1
            )
            SELECT ST_Contains(pz.object_position, lp.geom) AS is_inside
            FROM playerZone pz, latest_point lp;`,
        values: [sessionID, gameID]
    };
    try {
        const res = await pool.query(query);
        if (res.rows.length > 0) {
            console.log(res.rows[0]);
            return res.rows[0].is_inside;
        } else {
            console.log('No data found for the given session ID.');
            return false;
        }
    } catch (err) {
        console.error('Error executing query:', err);
        //throw err;
        return true;
    }
}

// geo
// walk over someone elses, delete their trail
exports.createTrail = async (session_id, lat, long, game_id) => {
    const query = `
    DO $$
    DECLARE
        existing_position GEOMETRY;
        new_object_id INT;
        new_point GEOMETRY;
    BEGIN
        SELECT 
            os.object_position, 
            os.object_id
        INTO 
            existing_position, 
            new_object_id
        FROM 
            app_data.object_status os
            JOIN app_data.object_data od ON os.object_id = od.object_id
        WHERE 
            os.session_id = ${session_id} 
            AND od.game_id = ${game_id} 
            AND od.object_type = 'Player Trail'
        ORDER BY 
            os.log_time DESC
        LIMIT 1;
    
        -- Convert latitude and longitude into a point in SRID 4326
        new_point := ST_SetSRID(ST_MakePoint(${long}, ${lat}), 4326);
    
        -- Insert a new record if an existing position was found
        IF existing_position IS NOT NULL THEN
            -- Convert existing position to SRID 4326 for consistency
            existing_position := ST_SetSRID(existing_position, 4326);
    
            -- Buffer the new point and union with the existing position
            INSERT INTO app_data.object_status (session_id, object_id, object_position)
            VALUES (
                ${session_id},
                new_object_id,
                ST_Union(
                    ST_Buffer(new_point::geography, 10)::geometry,
                    existing_position
                )
            );
        ELSE
            -- Insert into object_data and get the new object_id
            WITH cte AS (
                INSERT INTO app_data.object_data (game_id, object_type) 
                VALUES (${game_id}, 'Player Trail') 
                RETURNING object_id
            )
            -- Buffer the new point for the new position
            INSERT INTO app_data.object_status (session_id, object_id, object_position) 
            VALUES (
                ${session_id}, 
                (SELECT cte.object_id FROM cte), 
                ST_Buffer(new_point::geography, 2.286)::geometry 
            );
        END IF;
    END $$;
    
    `;
    
    await pool.query(query);
    await exports.createLoopedTerritory(session_id, game_id);
    await exports.updateTrailIntersection(session_id, game_id);
};

exports.createLoopedTerritory = async (session_id, game_id) => {
    let query = {
        text: `
WITH LatestLog AS (
    SELECT 
        os.*,
        ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS rn
    FROM 
        app_data.object_status os
    JOIN 
        app_data.object_data od ON os.object_id = od.object_id
    WHERE 
        od.game_id = $2
),
LatestSessionLog AS (
    SELECT *
    FROM LatestLog
    WHERE rn = 1
    AND session_id = $1
)

INSERT INTO app_data.object_status (session_id, object_id, object_position, log_time)
SELECT
    lsl.session_id,
    os.object_id,
    ST_BuildArea(ST_MakePolygon(ST_ExteriorRing(ST_Collect(os.object_position)))) AS polygon_without_holes,
    CURRENT_TIMESTAMP
FROM 
    LatestSessionLog lsl
JOIN
    app_data.object_status os ON lsl.pos_id = os.pos_id
WHERE 
    os.object_position IS NOT NULL
    AND ST_GeometryType(os.object_position) = 'ST_Polygon'
GROUP BY
    lsl.session_id, os.object_id
HAVING
    ST_NumInteriorRings(ST_Union(os.object_position)) > 0;

`,
        values: [session_id, game_id]
    }
    await pool.query(query);

    let fillLoop = {
        text: `
WITH latest_object_status AS (
    SELECT *
    FROM app_data.object_status
    WHERE session_id = $1
    ORDER BY log_time DESC
    LIMIT 1
),
cleaned_multipolygon AS (
    SELECT 
        ST_BuildArea(ST_Union(ST_ExteriorRing(d.geom))) AS cleaned_geom, 
        los.object_id, 
        los.session_id
    FROM latest_object_status los,
         LATERAL (SELECT (ST_Dump(los.object_position)).geom) AS d
    GROUP BY los.object_id, los.session_id
)

INSERT INTO app_data.object_status (session_id, object_id, object_position)
SELECT 
    cm.session_id, 
    cm.object_id, 
    ST_SetSRID(cm.cleaned_geom, 4326) AS object_position
FROM cleaned_multipolygon cm;`,
        values: [session_id]
    };
    await pool.query(fillLoop);
}

exports.updateTrailIntersection = async(session_id, game_id) => {
    const query = {
        text: `WITH LatestLog AS (
            SELECT 
                os.*,
                ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS rn
            FROM 
                app_data.object_status os
            JOIN 
                app_data.object_data od ON os.object_id = od.object_id
            WHERE 
                od.game_id = $2
        ),
        LatestSessionLog AS (
            SELECT *
            FROM LatestLog
            WHERE rn = 1
        ),
        Session8Position AS (
            SELECT object_position
            FROM LatestSessionLog
            WHERE session_id = $1
        )
        INSERT INTO app_data.object_status (session_id, object_id, object_position, log_time)
        SELECT 
            lsl.session_id,
            lsl.object_id,
            CASE
                WHEN lsl.object_position IS NOT NULL 
                     AND Session8Position.object_position IS NOT NULL
                     AND ST_Intersects(lsl.object_position, Session8Position.object_position)
                     AND lsl.session_id != $1
                THEN 
                    ST_Difference(lsl.object_position, Session8Position.object_position)
                ELSE 
                    lsl.object_position
            END AS object_position,
            CURRENT_TIMESTAMP AS log_time
        FROM 
            LatestSessionLog lsl
        JOIN 
            app_data.object_data od ON lsl.object_id = od.object_id
        LEFT JOIN 
            Session8Position ON true
        WHERE 
            lsl.session_id != $1
            AND (
                ST_Intersects(lsl.object_position, Session8Position.object_position)
            )`,
        values: [session_id,game_id] 
    }
    await pool.query(query);
}
//this should call on method to update leaderboard score
exports.updatedTrailScore = async(session_id) => {
    const query = `
    SELECT ST_Area(ST_Transform(object_position, 3857)) AS area FROM app_data.object_status
    WHERE session_id = $1
    ORDER BY log_time DESC
    LIMIT 1`
    const req = await pool.query(query, [session_id])
    console.log("Area captured via trails:", req.rows[0].area)
    return Math.round(req.rows[0].area)
}
exports.calculateAreaScore = async (session_id, gameID) => {
    // Adding updatedTrailScore and updatedLoopScore
    const newTrailScore = await exports.updatedTrailScore(session_id)
    let totalScore = newTrailScore //+ updatedLoopScore;
  
    // Dividing by boundingArea, rounding to the nearest 0.001
    const playArea = await getBoundingArea(gameID);
    console.log(`totalScore:${totalScore}, playArea:${playArea}`);
    let result = Math.round((totalScore / playArea) * 100000) / 1000;
    console.log("Calculated score:",result);
    const query = {
        text: `INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
            SELECT game_id, session_id, team, player_state, $3, config
            FROM app_data.player_state_data
            WHERE session_id = $2 AND game_id = $1
            ORDER BY log_time DESC LIMIT 1
            RETURNING *;`,
        values: [gameID, session_id, result]
    }
    await pool.query(query)
}
async function getBoundingArea(gameID){
    // This query should be changed to get the area dynamically from the geom
    const query = {
        text: `
            SELECT gd.game_id, rd.rule_name, rd.geom, rd.config
            FROM app_data.rules_data rd
            JOIN app_data.game_data gd on gd.game_bounds = rd.rule_name
            WHERE gd.game_id = $1;
        `,
        values: [gameID]
    }
    const res = await pool.query(query);
    return res.rows[0].config.area;
}

exports.testingEndpoint = async(event) => {
    //return await exports.getGameStatus(4)
    //return await exports.insertGeoData(event)
    //return await exports.getRunningGames()
    //await exports.getRunningGames(event);
    //return await exports.getLong(event)
    //return await exports.getPlayerPosition(event)
    //return await exports.checkInBoundary(event)
    //return await exports.cleanupGames();
    //return await checkGameDuration(data)
    return await exports.updateCameras(3, '{"upper": "5", "lower": "30"}', '{"upper": "1", "lower": "30"}', 10)
    //return await exports.getRunningCameras(3, 1)
}

exports.checkGameDuration = async(gameData) => {
    let gs = parseInt(gameData.game_state, 2);
    let inProgressGame = gs & 0b10000010;
    inProgressGame = (inProgressGame == 0b00000010);
    if (!inProgressGame) {
        return gameData;
    }
    //select oldest 
    const query = `
    WITH OldestLog AS (
    SELECT
        game_id,
        game_state,
        status_config,
        log_time,
        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY log_time ASC) AS rn
    FROM app_data.game_status_log
    WHERE game_id = $1 AND game_state & B'00000010' = B'00000010'
    )

    INSERT INTO app_data.game_status_log (game_id, game_state, status_config, log_time)
    SELECT
        g.game_id,
        (ol.game_state | B'10000000') AS game_state,
        ol.status_config,
        CURRENT_TIMESTAMP AS log_time
    FROM
        app_data.game_data g
    JOIN (
        SELECT *
        FROM OldestLog
        WHERE rn = 1
        AND game_state & B'10000010' = B'00000010'
    ) ol
    ON
        g.game_id = ol.game_id
    WHERE
        (CURRENT_TIMESTAMP - ol.log_time) > (g.game_duration * interval '1 minute')
    RETURNING *;
    `
    const { rows } = await pool.query(query, [gameData.game_id]);
    if (rows.length === 0) {
        console.log('No rows were inserted in checkGameDuration.');
        return gameData;
    } else {
        console.log('Game duration ended:', rows);
        //can be optimized to not call on getGame.
        return rows[0];
    }
}

exports.cleanupGames = async() => {
    query = `
    WITH LatestLog AS (
        SELECT
            game_id,
            game_state,
            status_config,
            log_time,
            ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY log_time DESC) AS rn
        FROM app_data.game_status_log
    )
    
    --holds game state to change to if it meets conditions below
    , AlteredGameState AS (
        SELECT
            game_id,
            (game_state | B'10000001') AS altered_game_state, 
            status_config
        FROM LatestLog
        WHERE rn = 1
    )
    

    -- Insert into game_status_log with altered game_state, but check condition on original game_state
    INSERT INTO app_data.game_status_log (game_id, game_state, status_config)
    SELECT
        ll.game_id,
        ags.altered_game_state, 
        ll.status_config
    FROM LatestLog ll
    JOIN AlteredGameState ags ON ll.game_id = ags.game_id
    WHERE ll.rn = 1 AND (ll.game_state & B'10000011') = B'00000001' AND NOW() - log_time >= INTERVAL '${gc.GAME_CLEANUP_THRESHOLD}';
    `
    await pool.query(query)
    //console.log(res.rows)
}

// Grabbing active players in a given game
exports.getPlayersInGame = async (gameID) => {
    console.log("Grabbing the players in Game", gameID);
    const query = {
        text: `SELECT * FROM(
                SELECT DISTINCT ON (session_id) *
                FROM app_data.player_state_data
                WHERE game_id = $1
                ORDER BY session_id, log_time DESC
            ) WHERE (player_state & B'00000001') = B'00000001';`,
        values: [gameID],
    }
    const res = await pool.query(query);
    return res.rows;
}

// Gets the most recent game status data for the given game
exports.getGameStatusData = async (gameID) => {
    console.log("Grabbing game status data", gameID);
    const query = {
        text: `SELECT game_state, log_time FROM app_data.game_status_log 
        WHERE game_id = $1 
        ORDER BY log_time DESC
        LIMIT 1;`,
        values: [gameID]
    }
    const res =  await pool.query(query);
    return res.rows[0];
}

exports.getPlacedItems = async (gameID) => {
    console.log(`Getting rabbit game items for game ${gameID}`);
    const query = `
        WITH latest_obj_status AS (
            SELECT * FROM (
                SELECT *,
                    CASE WHEN GeometryType(os.object_position) = 'POINT' 
                        THEN ST_X(os.object_position) ELSE NULL END AS long,
                    CASE WHEN GeometryType(os.object_position) = 'POINT' 
                        THEN ST_Y(os.object_position) ELSE NULL END AS lat, 
                    ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num
                FROM app_data.object_status os
            )
            WHERE row_num = 1 AND object_position IS NOT NULL
        )
        SELECT *
        FROM app_data.object_data od
        JOIN latest_obj_status los ON los.object_id = od.object_id
        WHERE (object_type = 'Landmine' OR object_type = 'Trap' OR object_type = 'Pellet')
            AND game_id = $1
    `;
    const res = await pool.query(query, [gameID]);
    return res.rows;
}

exports.getAllDrops = async (gameID) =>{
    console.log(`Getting drop locations for game ${gameID}`);
    const query = `
        WITH current_status AS (
            SELECT session_id, object_id, log_time, object_state, status_config, 
                CASE WHEN GeometryType(os.object_position) = 'POINT' 
                    THEN ST_X(os.object_position) ELSE NULL END AS long,
                CASE WHEN GeometryType(os.object_position) = 'POINT' 
                    THEN ST_Y(os.object_position) ELSE NULL END AS lat,
                ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num 
            FROM app_data.object_status os
            WHERE object_position IS NOT NULL
        )
        SELECT cs.object_id, object_type, lat, long, game_id, session_id, object_state, status_config
        FROM current_status cs
        JOIN app_data.object_data ON cs.object_id = object_data.object_id
        WHERE row_num = 1 AND object_type = 'Dead Drop' AND game_id = $1;
    `;
    const res = await pool.query(query, [gameID]);
    // console.log("Drop Data:",res.rows);
    return res.rows;
}

exports.getPlayerDropObj = async (sessionID) => {
    console.log(`getPlayerDropObj for session ${sessionID}`);
    const query = `
      WITH latest_object_status AS (
        SELECT os.pos_id,os.session_id,os.object_id,os.object_position,os.log_time,
            ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num 
        FROM app_data.object_status os
        JOIN app_data.object_data od ON os.object_id = od.object_id
        WHERE od.object_type = 'Dead Drop'
      )
      SELECT los.pos_id,los.session_id,los.object_id,los.object_position,los.log_time,od.game_id,od.object_type,od.config AS object_config,i.inv_id,i.config AS inventory_config
      FROM latest_object_status los
      JOIN app_data.object_data od ON los.object_id = od.object_id
      JOIN app_data.inventory i ON los.session_id = i.session_id AND los.object_id = i.object_id
      WHERE row_num = 1 AND los.session_id = $1
      ORDER BY log_time DESC LIMIT 1;
    `;
    const res = await pool.query(query, [sessionID]);
    return res.rows[0];
}

exports.getAssignedCollectObj = async (sessionID) => {
    console.log(`getAssignedCollectObj for session ${sessionID}`);
    const query = `
        WITH latest_object_status AS (
            SELECT os.pos_id,os.session_id,os.object_id,os.object_position,os.log_time,status_config,
                ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num 
            FROM app_data.object_status os
            JOIN app_data.object_data od ON os.object_id = od.object_id
            WHERE od.object_type = 'Dead Drop' AND object_position IS NOT NULL
        )
        SELECT los.pos_id,los.session_id,los.object_id,los.object_position,los.log_time,
            od.game_id,od.object_type,od.config AS object_config,status_config,ST_X(los.object_position) AS long, ST_Y(los.object_position) AS lat
        FROM latest_object_status los
        JOIN app_data.object_data od ON los.object_id = od.object_id
        WHERE row_num = 1 AND (los.status_config->>'Collector')::INT = $1
        ORDER BY log_time DESC LIMIT 1;
    `;
    const res = await pool.query(query, [sessionID]);
    return res.rows[0];
}

exports.updateObjPos = async (sessionID, objID, objPos) => {
    const query = `
        INSERT INTO app_data.object_status (object_id, session_id, object_position, object_state, status_config)
        SELECT object_id, $1, $3, object_state, status_config
        FROM app_data.object_status 
        WHERE object_id = $2
        ORDER BY log_time DESC LIMIT 1
        RETURNING *;
    `;
    await pool.query(query, [sessionID, objID, objPos]);
}

exports.updateObjTime = async (sessionID) => {
    const query = `
        UPDATE app_data.object_status
        SET log_time = CURRENT_TIMESTAMP
        WHERE pos_id = (
            SELECT pos_id
            FROM app_data.object_status
            WHERE session_id = $1
            ORDER BY log_time DESC
            LIMIT 1
        )
        RETURNING *;
    `;
    await pool.query(query, [sessionID]);
}

exports.putInInventory = async(sessionID, gameID, objID) => {
    const query = `INSERT INTO app_data.inventory (session_id, game_id, object_id) VALUES ($1,$2,$3);`;
    await pool.query(query, [sessionID, gameID, objID]);
}

exports.removeFromInventory = async (sessionID, objID) => {
    const query = `DELETE FROM app_data.inventory WHERE session_id = $1 AND object_id = $2`;
    await pool.query(query, [sessionID, objID]);
}

exports.clearInventory = async (sessionID) => {
    const query = `DELETE FROM app_data.inventory WHERE session_id = $1`;
    await pool.query(query, [sessionID]);
}

exports.getPelletsInInventories = async (gameID) => {
    const query = `
        SELECT *
        FROM app_data.inventory AS i
        JOIN app_data.object_data AS od ON od.object_id = i.object_id
        WHERE od.object_type = 'Pellet' AND i.game_id = $1;
    `;
    const res = await pool.query(query, [gameID]);
    return res.rows;
}

exports.updateObjState = async (objID, bitToFlip) => {
    console.log(`Updating Obj ${objID}'s state on bit ${bitToFlip}`);
    const query = `
        INSERT INTO app_data.object_status (object_id, session_id, object_position, object_state, status_config)
        SELECT object_id, session_id, object_position, object_state # $2, status_config
        FROM app_data.object_status 
        WHERE object_id = $1
        ORDER BY log_time DESC LIMIT 1
        RETURNING *;
        `;
    await pool.query(query, [objID, bitToFlip]);
}

exports.createCameraLocations = async(bounds) => {
    query = {
        text: `WITH map AS (
            SELECT geom FROM app_data.rules_data
            WHERE rule_name = $1
        ),
        
        maxmin AS (
            SELECT 
                ST_XMax(map.geom) as xmax, 
                ST_XMin(map.geom) as xmin, 
                ST_YMax(map.geom) as ymax, 
                ST_YMin(map.geom) as ymin
            FROM map
        ),
        cameraPoints AS (
            SELECT 
                generate_series(1, 10) as id,
                (((maxmin.xmax - maxmin.xmin) * random()) + maxmin.xmin) as camX, 
                (((maxmin.ymax - maxmin.ymin) * random()) + maxmin.ymin) as camY
            FROM maxmin
        )
        
        INSERT INTO app_data.camera_data (rule_name, lat, long) 
        SELECT 
            $1 as rule_name,
            cp.camX as long,
            cp.camY as lat
        FROM cameraPoints cp;`,
        values: [bounds]
    }
    await pool.query(query);
}
// Inserts cameras for respective map as disabled.
// Called on gamem creation.
exports.setupCameras = async(gameID, bounds) => {
    let query = {
        text: `
            INSERT INTO app_data.camera_status (game_id, camera_id, camera_status)
            SELECT $1, cd.camera_id, B'0100'
            FROM app_data.camera_data cd
            WHERE rule_name = $2
            RETURNING *
        `,
        values:[gameID, bounds]
    }
    let res = await pool.query(query);
    console.log(res.rows[0])
    if(!(res.rows[0])){
        await exports.createCameraLocations(bounds)
        await pool.query(query);
    }

}

/* 
Updates cameras state accordingly (warmed up, start, expire)
and adds cameras needed accordingly. 

Relies on game data config to be called, or data to be filled in.
Called on during Phase 2 of Dead Drop.
*/ 
exports.updateCameras = async (gameID, lrange, urange, lduration, uduration, maxCams) => {
    console.log(`updating cameras in game ${gameID}`);
    //let rangeJSON = JSON.parse(range);
    //let durationJSON = JSON.parse(duration)
    //console.log(gameID, rangeJSON.lower, durationJSON.upper, maxCams)
    
    const query = `
        DO $$
        DECLARE
            v_game_id INT := ${gameID};
            v_min_dur INT := ${lduration};
            v_max_dur INT := ${uduration};
            v_min_range INT := ${lrange};
            v_max_range INT := ${urange};
            v_max_cameras INT := ${maxCams};
            inserted_row_count INT;
            v_warmup_time INT := 10;
        BEGIN
            CREATE TEMP TABLE temp_LatestSessionLog AS
            WITH LatestLog AS (
                SELECT 
                    cs.*,
                    cd.lat,
                    cd.long,
                    ROW_NUMBER() OVER (PARTITION BY cs.camera_id ORDER BY cs.log_time DESC) AS rn
                FROM 
                    app_data.camera_status cs
                JOIN 
                    app_data.camera_data cd ON cs.camera_id = cd.camera_id
                WHERE 
                    cs.game_id = v_game_id
            )
            SELECT *
            FROM LatestLog
            WHERE rn = 1;

            -- Remove expired and start "warmed up" cameras
            WITH inserted_rows AS (
                INSERT INTO app_data.camera_status(game_id, camera_id, camera_status, camera_diameter, camera_range, camera_duration, log_time)
                SELECT 
                    game_id, 
                    camera_id, 
                    CASE 
                        WHEN log_time < NOW() - (v_warmup_time || ' seconds')::INTERVAL AND (camera_status & B'0111') = B'0001' THEN B'0010'
                        WHEN log_time < NOW() - (camera_duration || ' seconds')::INTERVAL AND (camera_status & B'0110') = B'0010' THEN B'0100'
                    END,
                    camera_diameter, 
                    camera_range, 
                    camera_duration,
                    CURRENT_TIMESTAMP
                FROM temp_LatestSessionLog
                WHERE 
                    (log_time < NOW() - (v_warmup_time || ' seconds')::INTERVAL AND (camera_status & B'0111') = B'0001')
                    OR (log_time < NOW() - (camera_duration || ' seconds')::INTERVAL AND (camera_status & B'0110') = B'0010')
                RETURNING 1
            )
            SELECT COUNT(*) INTO inserted_row_count FROM inserted_rows;

            -- Insert new cameras
            WITH new_cameras AS (
                SELECT 
                    camera_id, 
                    lat, 
                    long,
                    floor(random() * (v_max_dur - v_min_dur + 1) + v_min_dur)::int AS random_duration,
                    floor(random() * (v_max_range - v_min_range + 1) + v_min_range)::int AS random_range
                FROM temp_LatestSessionLog
                WHERE (camera_status & B'0011') = B'0000'
                LIMIT (v_max_cameras - inserted_row_count)
            )
            INSERT INTO app_data.camera_status (game_id, camera_id, camera_status, camera_range, camera_duration, camera_diameter, log_time)
            SELECT 
                v_game_id, 
                camera_id, 
                B'0001', 
                ST_Buffer(ST_SetSRID(ST_MakePoint(lat, long), 4326)::geography, random_range)::geometry,
                random_duration, 
                random_range,
                CURRENT_TIMESTAMP
            FROM new_cameras;
            DROP TABLE temp_LatestSessionLog;
        END $$;
    `;
    const cameras = await this.cameraPenalties(gameID, 1);
    try {
        await pool.query(query);
        console.log('Cameras have been updated!');
        return cameras

    } catch (err) {
        console.error('Camera update error:', err);
        throw err; // Throw the error for handling in higher levels
    }
  };

/* 
Assigns point penalties for players in camera range
Returns list of all active or warming up cameras 
*/
exports.cameraPenalties = async(gameID, penalty) => {
    const query = {
        text:` 
            WITH LatestLog AS (
            SELECT 
                cs.camera_id,
                cs.camera_status,
                cs.camera_diameter,
                cs.camera_range,
                cs.camera_duration,
                cs.log_time,
                cd.lat,
                cd.long
            FROM 
                app_data.camera_status cs
            JOIN 
                app_data.camera_data cd ON cs.camera_id = cd.camera_id
            WHERE 
                cs.game_id = $1
                AND cs.log_time = (
                    SELECT MAX(log_time)
                    FROM app_data.camera_status
                    WHERE camera_id = cs.camera_id AND game_id = $1
                )
            ), 
            LatestGeoLog AS (
                SELECT DISTINCT ON (sd.session_id)
                    sd.session_id,
                    gd.geom,
                    gd.lat,
                    gd.long
                FROM 
                    app_data.geo_data AS gd
                JOIN 
                    app_data.session_data AS sd ON sd.device_id = gd.device_id
                ORDER BY sd.session_id, gd.log_time DESC
            ),
            LatestPlayerScores AS (
                SELECT DISTINCT ON (psd.session_id)
                    psd.session_id,
                    psd.game_id,
                    psd.team,
                    psd.player_state,
                    psd.score,
                    psd.config
                FROM 
                    app_data.player_state_data AS psd
                WHERE 
                    psd.game_id = $1
                ORDER BY psd.session_id, psd.log_time DESC
            ),
            inserted_data AS (
                INSERT INTO app_data.player_state_data(game_id, session_id, team, player_state, score, config)
                SELECT 
                    lps.game_id,
                    lps.session_id,
                    lps.team,
                    lps.player_state,
                    lps.score - $2,
                    lps.config
                FROM 
                    LatestPlayerScores lps
                JOIN 
                    LatestGeoLog lgl ON lps.session_id = lgl.session_id
                JOIN 
                    LatestLog lr ON ST_Contains(lr.camera_range, lgl.geom) AND (lr.camera_status & B'0111') = B'0010'
                WHERE 
                    (lps.player_state & B'00000001') = B'00000001'
                RETURNING *
            )
            SELECT camera_id, camera_status, camera_diameter, camera_duration, log_time, lat, long
            FROM LatestLog
            WHERE (camera_status & B'0111') IN (B'0001', B'0010');
            `,
        values: [gameID, penalty]
    }
    const res = await pool.query(query);
    // console.log('Active Cameras: ', res.rows)
    return res.rows; //list of json, holding camera data.
}

exports.giveNewObject = async (sessionID, gameID, objectType) => {
    console.log("Creating new", objectType, "object for", sessionID, "of game id:", gameID);
    const query = {
        text: `
            WITH new_obj AS (
                INSERT INTO app_data.object_data (game_id, object_type)
                VALUES ($1, $2) 
                RETURNING *
            ), obj_stat AS (
                INSERT INTO app_data.object_status (session_id, object_id)
                VALUES ($3, (SELECT object_id FROM new_obj))
                RETURNING *
            )
            INSERT INTO app_data.inventory ( session_id, game_id, object_id )
            VALUES ($3, $1, (SELECT object_id FROM new_obj))
            RETURNING *;
        `,
        values: [gameID, objectType, sessionID]
    }
    const res = await pool.query(query);
    console.log(res.rows[0].object_id);
    return res.rows[0].object_id;
}

exports.getTimeOfLastGivenObject = async (gameID, objectType, sessionID) => {
    console.log(`Getting last given ${objectType} for player ${sessionID} in game ${gameID}`);
    const query = `
        SELECT *
        FROM app_data.object_status AS os
        JOIN app_data.object_data AS od ON os.object_id = od.object_id
        WHERE object_position IS NULL
            AND object_state = B'00000000'
            AND game_id = $1 
            AND object_type = $2
            AND session_id = $3
        ORDER BY log_time DESC LIMIT 1;
    `;
    const res = await pool.query(query,[gameID, objectType, sessionID]);
    if(res.rows[0]){
        return res.rows[0].log_time;
    } else {
        return 0;
    }
}

exports.getTimeOfLastDroppedObject = async (gameID, objectType, sessionID) => {
    console.log(`Getting last given ${objectType} for player ${sessionID} in game ${gameID}`);
    const query = `
        SELECT *
        FROM app_data.object_status AS os
        JOIN app_data.object_data AS od ON os.object_id = od.object_id
        WHERE object_position IS NOT NULL
            AND object_state = B'00000000'
            AND game_id = $1 
            AND object_type = $2
            AND session_id = $3
        ORDER BY log_time DESC LIMIT 1;
    `;
    const res = await pool.query(query,[gameID, objectType, sessionID]);
    if(res.rows[0]){
        return res.rows[0].log_time;
    } else {
        return 0;
    }
}

exports.createLocationObject = async (sessionID, gameID, objectType, pos) => {
    console.log("Creating new", objectType, "object at", pos, "for", sessionID, "of game id:", gameID);
    const query = {
        text: `
            WITH new_obj_data AS (
                INSERT INTO app_data.object_data(game_id, object_type)
                VALUES($1, $2) RETURNING game_id, object_type, object_id
            )
            INSERT INTO app_data.object_status(session_id, object_id, object_position)
            VALUES($3, (SELECT new_obj_data.object_id FROM new_obj_data), $4);
        `,
        values: [gameID, objectType, sessionID, pos]
    }
    const res = await pool.query(query);
}

exports.getStartLocation = async (sessionID, gameID) => {
    console.log("Getting start location for session", sessionID, "in game", gameID);
    const query = {
        text: `
            SELECT session_id, game_id, ST_X(os.object_position) AS long, ST_Y(os.object_position) AS lat
            FROM app_data.object_data od
            JOIN app_data.object_status os ON os.object_id = od.object_id
            WHERE od.object_type = 'Player Starting Location'
                AND session_id = $2 AND game_id = $1;
        `,
        values: [gameID, sessionID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.getFlagLocations = async (gameID, zone) => {
    console.log("Getting flag locations for zone", zone, "in game", gameID);
    const query = {
        text: `
            SELECT flags.*
            FROM app_data.game_data gd
            JOIN app_data.flag_location_data flags ON flags.rule_name = gd.game_bounds
            WHERE gd.game_id = $1 AND flags.team = $2;
        `,
        values: [gameID, zone]
    }
    const res = await pool.query(query);
    return res.rows;
}

exports.updateFlagPos = async (gameID, flag, pos) => {
    console.log(`Updating flag ${flag} in game ${gameID} to be at pos ${pos}`);
    const query = `
        INSERT INTO app_data.object_status (object_id, object_position, object_state, status_config)
            SELECT os.object_id, $3, object_state, status_config
            FROM app_data.object_data od
            JOIN app_data.object_status os ON od.object_id = os.object_id
            WHERE od.object_type = $2 AND game_id = $1
            ORDER BY log_time DESC LIMIT 1
        RETURNING *;
    `;
    await pool.query(query, [gameID, flag, pos]);
}

exports.getNearestPlayer = async (sessionID, gameID, pos) => {
    console.log("Getting the nearest player to",sessionID,'in game',gameID,'at pos',pos);
    const query = {
        text: `
            WITH current_locations AS (
                SELECT device_id, long, lat, geom, log_time, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY log_time DESC) AS rn
                FROM app_data.geo_data 
            ),
            current_players AS(
                SELECT game_id, session_id, log_time, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY log_time DESC) AS rn
                FROM app_data.player_state_data 
                WHERE session_id != $1 AND game_id = $2
            )
            SELECT game_id, sd.session_id, long, lat, geom, (geom <-> $3::geometry) AS distance
            FROM current_players cp
            JOIN app_data.session_data sd ON sd.session_id = cp.session_id
            JOIN current_locations cl ON cl.device_id = sd.device_id
            WHERE cl.rn = 1 AND cp.rn = 1
            ORDER BY geom <-> $3::geometry LIMIT 1;
        `,
        values: [sessionID, gameID, pos],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.getNearestOpposingPlayer = async (sessionID, gameID, pos, team) => {
    console.log("Getting the nearest player to",sessionID,'in game',gameID,'at pos',pos);
    const query = {
        text: `
        WITH current_locations AS (
            SELECT device_id, long, lat, geom, log_time, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY log_time DESC) AS rn
            FROM app_data.geo_data 
        ),
        current_players AS(
        SELECT game_id, session_id, team, log_time, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY log_time DESC) AS rn
        FROM app_data.player_state_data 
        WHERE session_id != $1 AND game_id = $2 AND team != $4
        )
        SELECT game_id, sd.session_id, team, long, lat, geom, (geom <-> $3::geometry) AS distance
        FROM current_players cp
        JOIN app_data.session_data sd ON sd.session_id = cp.session_id
        JOIN current_locations cl ON cl.device_id = sd.device_id
        WHERE cl.rn = 1 AND cp.rn = 1
        ORDER BY geom <-> $3::geometry LIMIT 1;
        `,
        values: [sessionID, gameID, pos, team],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.getInventory = async (sessionID, gameID) => {
    console.log("Grabbing inventory for player", sessionID, "in game", gameID);
    const query = {
        text: `
            SELECT DISTINCT ON (i.object_id) i.*, os.object_position, os.object_state, od.object_type, os.log_time
            FROM app_data.inventory i
            JOIN app_data.object_status os ON os.object_id = i.object_id
            JOIN app_data.object_data od ON od.object_id = i.object_id
            WHERE i.game_id = $2
            AND i.session_id = $1
            ORDER BY i.object_id, log_time DESC;
        `,
        values: [sessionID, gameID]
    }
    const res = await pool.query(query);
    return res.rows;
}

exports.getItemFromInventory = async (gameID, sessionID, itemType) => {
    console.log("Grabbing inventory for player", sessionID, "in game", gameID);
    const query = {
        text: `
            WITH playerInventory AS (
                SELECT * FROM app_data.inventory 
                WHERE game_id = $2 AND session_id = $1
            ), stored_objects AS (
                SELECT playerInventory.*, app_data.object_status.object_position, app_data.object_status.object_state, app_data.object_data.object_type
                FROM playerInventory
                JOIN app_data.object_status on app_data.object_status.object_id = playerInventory.object_id
                JOIN app_data.object_data on app_data.object_data.object_id = playerInventory.object_id
            )
            SELECT * FROM stored_objects so
            WHERE object_type = $3
            LIMIT 1
        `,
        values: [sessionID, gameID, itemType]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.increasePlayerScore = async (gameID, sessionID, score) => {
    console.log("Updating score", score, "for player", sessionID, "in game", gameID);
    const query = {
        text: `INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
            SELECT game_id, session_id, team, player_state, score + $3, config
            FROM app_data.player_state_data 
            WHERE session_id = $2 AND game_id = $1 
            ORDER BY log_time DESC LIMIT 1
            RETURNING *;`,
        values: [gameID, sessionID, score],
    }
    const res = await pool.query(query);
    return res.rows[0];
}

exports.getPlayerRecentMovement = async (sessionID, time) => {
    const query = {
        text: `WITH session_info AS (
                SELECT device_id
                FROM app_data.session_data
                WHERE session_id = $1
            ),
            recent_points AS (
                SELECT gd.geo_id, gd.log_time, gd.geom
                FROM app_data.geo_data gd
                JOIN session_info si ON gd.device_id = si.device_id
                WHERE gd.log_time >= NOW() - INTERVAL '${time} seconds'
            ),
            most_recent_point AS (
                SELECT geo_id, log_time, geom
                FROM recent_points
                ORDER BY log_time DESC
                LIMIT 1
            )
            SELECT ST_Distance(rp.geom, mrp.geom) AS distance, rp.geo_id, rp.log_time, rp.geom
            FROM recent_points rp
            CROSS JOIN most_recent_point mrp
            ORDER BY ST_Distance(rp.geom, mrp.geom) DESC
            LIMIT 1;
            `,
        values: [sessionID],
    }
    const res = await pool.query(query);
    if(res.rows[0]){
        return res.rows[0]?.distance;
    } else {
        return 0;
    }
}

// Assigns a collecting user to the dead drop object and puts it in object status
exports.assignDrop = async (gameID, sessionID, collector, safeZone) => {
    const query = {
        text: `
            WITH ranked_entries AS (
                SELECT os.*, ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS entry_number
                FROM app_data.object_status os
            ),
            entries AS (
                SELECT od.*, re.pos_id, re.session_id, re.object_position, re.object_state, re.status_config, re.log_time
                FROM app_data.object_data od 
                JOIN ranked_entries re 
                ON od.object_id = re.object_id
            ),
            dead_drop AS (
                SELECT * FROM entries 
                    WHERE game_id = $1 and object_type = 'Dead Drop' and session_id = $2 AND object_position IS NOT NULL
                    ORDER BY session_id ASC
            )
            INSERT INTO app_data.object_status (session_id, object_id, object_position, object_state, status_config)
            SELECT session_id,object_id,object_position,object_state,
                jsonb_set(
                    jsonb_set(status_config, '{Collector}', to_jsonb($3::int), true), 
                    '{Safe}', to_jsonb($4::int), true
                ) AS status_config
                FROM dead_drop
            RETURNING *`,
        values: [gameID, sessionID, collector, safeZone]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

// Grabs the dead drop for a single player in a single game
exports.grabDeadDrop = async (sessionID, gameID) => {
    console.log("Grabbing dead drop for player", sessionID, "in game", gameID);
    const query = {
        text: `WITH ranked_entries AS (
            SELECT os.*, ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS entry_number
            FROM app_data.object_status os
        ),
        entries AS (
            SELECT od.*, re.pos_id, re.session_id, re.object_position, re.object_state, re.status_config, re.log_time
            FROM app_data.object_data od 
            JOIN ranked_entries re 
            ON od.object_id = re.object_id
        ) 
        SELECT * FROM entries 
        WHERE game_id = $1 and object_type = 'Dead Drop' and session_id = $2
        ORDER BY log_time DESC
        LIMIT 1`,
        values: [gameID, sessionID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

// Grabs all of the dead drops in the given game
exports.grabDeadDrops = async (gameID) => {
    console.log("Grabbing the dead drops in game", gameID);
    const query = {
        text: `WITH ranked_entries AS (
            SELECT os.*, ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS entry_number
            FROM app_data.object_status os
        ),
        entries AS (
            SELECT od.*, re.pos_id, re.session_id, re.object_position, re.object_state, re.status_config, re.log_time
            FROM app_data.object_data od 
            JOIN ranked_entries re 
            ON od.object_id = re.object_id
        ) 
        SELECT DISTINCT ON (session_id) * FROM entries 
        WHERE game_id = $1 and object_type = 'Dead Drop' AND object_position IS NOT NULL
        ORDER BY session_id, log_time DESC
        `,
        values: [gameID]
    }
    const res = await pool.query(query);
    return res.rows;
}

// Grabs the starting location for a single player in a single game
exports.grabSafeZone = async (sessionID, gameID) => {
    console.log("Grabbing starting location for player", sessionID, "in game", gameID);
    const query = {
        text: `WITH ranked_entries AS (
            SELECT os.*, ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS entry_number
            FROM app_data.object_status os
        ),
        entries AS (
            SELECT od.*, re.pos_id, re.session_id, re.object_position, re.object_state, re.status_config, re.log_time
            FROM app_data.object_data od 
            JOIN ranked_entries re 
            ON od.object_id = re.object_id
        ) 
        SELECT * FROM entries 
        WHERE game_id = $1 and object_type = 'Player Starting Location' and session_id = $2
        ORDER BY log_time DESC
        LIMIT 1`,
        values: [gameID, sessionID]
    }
    const res = await pool.query(query);
    return res.rows[0];
}

// Grabs all of the safe zones in the given game
exports.grabSafeZones = async (gameID) => {
    console.log("Grabbing the safe zones in game", gameID);
    const query = {
        text: `WITH ranked_entries AS (
            SELECT os.*, ROW_NUMBER() OVER (PARTITION BY os.session_id ORDER BY os.log_time DESC) AS entry_number
            FROM app_data.object_status os
        ),
        entries AS (
            SELECT od.*, re.pos_id, re.session_id, re.object_position, re.object_state, re.status_config, re.log_time
            FROM app_data.object_data od 
            JOIN ranked_entries re 
            ON od.object_id = re.object_id
        ) 
        SELECT DISTINCT ON (session_id) * FROM entries 
        WHERE game_id = $1 and object_type = 'Player Starting Location'
        ORDER BY session_id, log_time DESC
        `,
        values: [gameID]
    }
    const res = await pool.query(query);
    return res.rows;
}

exports.getDistToSafeZone = async (gameID, sessionID) => {
    console.log(`Checking distance to safe zone for player ${sessionID} in game ${gameID}`);
    const query = `
        WITH latest_obj_status AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num
            FROM app_data.object_status AS os
        ),
        objs AS (
            SELECT *, od.object_id AS obj_id
            FROM app_data.object_data AS od
            JOIN latest_obj_status AS los ON od.object_id = los.object_id
            WHERE los.row_num = 1 AND object_type = 'Dead Drop' AND game_id = $2
        ),
        player_status AS (
            SELECT sd.session_id, gd.geom, gd.lat, gd.long
            FROM app_data.geo_data AS gd
            JOIN app_data.session_data AS sd ON sd.device_id = gd.device_id
            WHERE sd.session_id = $1
            ORDER BY gd.log_time DESC
            LIMIT 1
        )
        SELECT (ps.geom <-> objs.object_position::geometry) AS distance, ps.session_id, objs.obj_id, objs.status_config
        FROM player_status AS ps
        JOIN objs ON ps.session_id = (objs.status_config->>'Safe')::INT;
        `;
    const res = await pool.query(query, [sessionID, gameID]);
    return res.rows[0]?.distance;
}

exports.endOfPhase1Duration = async (gameID, duration) => {
    console.log("Checking the phase 1 duration for game", gameID);
    const query = {
        text: `WITH OldestLog AS (
                SELECT game_id,game_state,status_config,log_time, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY log_time ASC) AS rn
                FROM app_data.game_status_log
                WHERE game_id = $1 AND game_state & B'00000010' = B'00000010'
            )
            INSERT INTO app_data.game_status_log (game_id, game_state, status_config, log_time)
            SELECT g.game_id, (ol.game_state | B'00000100') AS game_state, ol.status_config, CURRENT_TIMESTAMP AS log_time
            FROM app_data.game_data g
            JOIN (
                SELECT *
                FROM OldestLog
                WHERE rn = 1
                AND game_state & B'00000110' = B'00000010'
            ) ol
            ON g.game_id = ol.game_id
            WHERE (CURRENT_TIMESTAMP - ol.log_time) > ($2 * interval '1 minute')
            RETURNING *;`,
        values: [gameID, duration],
    }
    const res = await pool.query(query);
    if (res.rows.length === 0) {
        console.log('No rows were inserted in endOfPhase1Duration.');
        return null;
    } else {
        console.log('Phase 1 ended:', res.rows);
        return res.rows[0];
    }
}

exports.calculateSafeZoneScore = async (sessionID, gameID, basePoints, pointDecay) => {
    //if game status doesn't have the first safe zone time reached timestamp, it adds it to config.
    const safeZoneTime = {
        text: `
            WITH latest_game_state AS (
                SELECT *
                FROM app_data.game_status_log
                WHERE game_id = $1
                ORDER BY log_time DESC
                LIMIT 1
            ),
            config_update AS (
                SELECT
                    COALESCE(
                        latest_game_state.status_config, 
                        '{}'::jsonb
                    ) || jsonb_build_object('first_safe_time', to_jsonb(current_timestamp)) AS status_config
                FROM latest_game_state
            )

            INSERT INTO app_data.game_status_log (game_id, game_state, status_config)
            SELECT lgs.game_id, lgs.game_state, config_update.status_config
            FROM config_update, latest_game_state lgs
            WHERE NOT (lgs.status_config ? 'first_safe_time');
        `,
        values: [gameID]
    }
    await pool.query(safeZoneTime);
    const scoreCalc = {
        text: `
        WITH first_timestamp AS (
            SELECT (status_config->>'first_safe_time')::timestamp AS first_safe_time
            FROM app_data.game_status_log
            WHERE game_id = $1
            ORDER BY log_time DESC
            LIMIT 1
        ),
        current_player AS (
            SELECT * from app_data.player_state_data WHERE session_id = $2 ORDER BY log_time DESC LIMIT 1
        ),
        time_difference AS (
            SELECT EXTRACT(EPOCH FROM NOW() - ft.first_safe_time) AS interval_seconds
            FROM first_timestamp ft
        )
        INSERT INTO app_data.player_state_data (game_id, session_id, team, player_state, score, config)
        SELECT cp.game_id, cp.session_id, cp.team, cp.player_state, ROUND(GREATEST(cp.score, cp.score + (-(td.interval_seconds * $4) + $3))), cp.config
        FROM current_player cp, time_difference td;
        `,
        values: [gameID, sessionID, basePoints, pointDecay]
    }
    await pool.query(scoreCalc);
    //score calc
}

exports.getNearestItem = async (gameID, sessionID, itemType) => {
    console.log(`Checking distance to ${itemType} for player ${sessionID} in game ${gameID}`);
    const query = `
        WITH latest_obj_status AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY os.object_id ORDER BY os.log_time DESC) as row_num
            FROM app_data.object_status AS os
        ),
        objs AS (
            SELECT *, od.object_id AS obj_id, los.session_id AS owner_session_id
            FROM app_data.object_data AS od
            JOIN latest_obj_status AS los ON od.object_id = los.object_id
            WHERE los.row_num = 1 AND object_position IS NOT NULL AND object_type = $3 AND game_id = $2
        ), player_state AS (
            SELECT session_id, game_id
            FROM app_data.player_state_data AS psd
            WHERE session_id = $1
            ORDER BY log_time DESC
            LIMIT 1
        ), player_pos AS (
            SELECT sd.session_id, gd.geom, gd.lat, gd.long, ps.game_id
            FROM app_data.geo_data AS gd
            JOIN app_data.session_data AS sd ON sd.device_id = gd.device_id
            JOIN player_state AS ps ON ps.session_id = sd.session_id
            ORDER BY gd.log_time DESC
            LIMIT 1
        )
        SELECT pp.session_id AS checked_session_id, objs.obj_id, objs.owner_session_id, objs.status_config, (pp.geom <-> objs.object_position) AS distance
        FROM player_pos AS pp
        JOIN objs ON pp.game_id = objs.game_id
        ORDER BY pp.geom <-> objs.object_position ASC LIMIT 1;
    `;
    const res = await pool.query(query, [sessionID, gameID, itemType]);
    return res.rows[0];
}

exports.createTeamZones = async (gameID, bounds) => {
    console.log(bounds)
    const query = {
        text:`
            WITH zone_color AS (
                SELECT 
                    game_config->>'teamAColor' AS zA, 
                    game_config->>'teamBColor' AS zB
                FROM 
                    app_data.game_data
                WHERE 
                    game_id = $1
            )
            INSERT INTO app_data.object_data (game_id, object_type, config)
            SELECT 
                $1, 
                'Zone A', 
                jsonb_build_object('color', zA, 'map', $2::text)
            FROM 
                zone_color
            UNION ALL
            SELECT 
                $1, 
                'Zone B', 
                jsonb_build_object('color', zB, 'map', $2::text)
            FROM 
                zone_color;
        `,
        values: [gameID, String(bounds)]
    }
    await pool.query(query)
}

exports.setPlayerZone = async (sessionID, gameID) => {
    console.log("Assigning player to team zone...")
    const query = {
        text:`
            WITH player AS (
                SELECT DISTINCT ON (psd.session_id)
                        psd.team
                    FROM 
                        app_data.player_state_data AS psd
                    WHERE 
                        psd.game_id = $2 AND psd.session_id = $1
                    ORDER BY psd.session_id, psd.log_time DESC
            ),
            obj AS (
                SELECT od.object_type, od.object_id AS id, od.config->>'map' AS mapName FROM app_data.object_data od, player
                WHERE od.config->>'color' = player.team AND game_id = $2 LIMIT 1
            ),
            map AS (
            SELECT 
                    CASE 
                        WHEN obj.object_type = 'Zone A' THEN zd.zoneA
                        ELSE zd.zoneB
                    END AS zBounds
                FROM 
                    app_data.zone_data zd
                JOIN obj ON zd.rule_name = obj.mapName
            )
            INSERT INTO app_data.object_status(session_id, object_id, object_position)
            SELECT 
                $1, 
                obj.id, 
                map.zBounds
            FROM 
                obj, map;
        `,
        values: [sessionID, gameID]
    }
    await pool.query(query);
}

exports.getFlags = async (gameID) => {
    console.log('Getting the flags in game', gameID);
    const query = `WITH Flag_data AS (
        SELECT * FROM app_data.object_data
        WHERE game_id = $1 AND (object_type = 'FlagA' OR object_type = 'FlagB')
    ),
    Flag_status AS (
        SELECT DISTINCT ON (object_id) *
        FROM app_data.object_status 
        WHERE object_id in (SELECT object_id FROM Flag_data)
        ORDER BY object_id, log_time DESC LIMIT 2
    )
    SELECT 
        Flag_status.*,         
        CASE WHEN GeometryType(Flag_status.object_position) = 'POINT'
        THEN ST_X(Flag_status.object_position) ELSE NULL END AS long, 
        CASE WHEN GeometryType(Flag_status.object_position) = 'POINT'
        THEN ST_Y(Flag_status.object_position) ELSE NULL END AS lat,  
        Flag_data.game_id, Flag_data.object_type, Flag_data.config
    FROM Flag_status
    JOIN Flag_data ON Flag_data.object_id = Flag_status.object_id;`;
    const res = await pool.query(query, [gameID]);
    return res.rows;
}

// Gets the username of a player
exports.getUsername = async (sessionID) => {
    console.log("Getting player " + sessionID + "s username");
    const query = `SELECT username FROM app_data.session_data 
    WHERE session_id = $1`;
    const res = await pool.query(query, [sessionID]);
    return res.rows[0].username;
}

// Grabs the team of the given player
exports.getTeam = async (sessionID) => {
    console.log('Getting team for player', sessionID);
    const query = `SELECT team FROM app_data.player_state_data 
    WHERE session_id = $1 ORDER BY log_time DESC LIMIT 1`;
    const res = await pool.query(query, [sessionID]);
    return res.rows[0].team;
}