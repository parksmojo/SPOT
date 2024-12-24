import axios from "axios";
import { Storage } from '@ionic/storage';
import { GameVals as gv } from "./GameVals";
import { GameStatusData, PlayerStatusData, gameComms } from "./Interfaces";

export class ServerFacade {
    static #host: string = import.meta.env.MODE === 'development' ? 'http://localhost:3000' : 'https://m6i1s0dpsg.execute-api.us-east-1.amazonaws.com';
    static #session: number | null = null;
    static gameInfo: any;
    static #gameList: any;
    static #gameID: number = 0;
    static #currPing: number = 0;
    static #storage = new Storage().create();
    static currGameComm: gameComms = gv.baseComm;
    static inGame: boolean = false;

    static getSession(){
        return this.#session;
    }
    static getPing(){
        return this.#currPing;
    }
    static getGameList(){
        return this.#gameList;
    }
    static getGameName () {
        return this.gameInfo?.game_name;
    }
    static getGameDuration () {
        return this.gameInfo?.game_duration;
    }
    static getStartTime() {
        //console.log('Curr start time:',this.currGameComm?.gameStatusData.time_started);
        return this.currGameComm?.gameStatusData.time_started;
    }
    static getPhaseDuration () {
        //console.log('Getting Phase Duration');
        const gameState: number = parseInt(this.currGameComm.gameStatusData.game_state, 2);
        if(!gameState) { return 0; }
        switch(this.gameInfo?.game_type){
            case gv.DEAD_DROP:
                if((gameState & 4) === 0){
                    return this.gameInfo?.game_config.dropPhase;
                } else {
                    return this.gameInfo?.game_duration;
                }
            default:
                return this.gameInfo?.game_duration;
        }
    }
    static getGameState() {
        return this.currGameComm.gameStatusData.game_state;
    }
    static gameIsRunning() {
        if(!this.currGameComm){ return false }
        const stateInt = parseInt(this.currGameComm?.gameStatusData?.game_state,2);
        return (stateInt & 0b10000010) === 0b00000010;
    }
    static getGameType() {
        return this.gameInfo?.game_type;
    }

    static getGameID() {
        return this.#gameID;
    }

    static getGameInfo() {
        return this.gameInfo;
    }

    static getGameStatusData() {
        return this.currGameComm?.gameStatusData;
    }

    static getPlayerStatusData() {
        return this.currGameComm?.playerStatusData;
    }

    static resetCurrGameComm(){
        this.currGameComm = gv.baseComm;
    }

    static isLoggedIn(){
        if(this.#session){
            return true;
        } else {
            return false;
        }
    };

    static parseComms(comms: any) {
        console.log("Comms:", comms);
        this.currGameComm = comms;
    };

    static async EndPriorSession() {
        const sess = await (await this.#storage).get('sessionID');
        const gameID = await (await this.#storage).get('gameID');
        if(sess){
            // This mess is so that it tries to leave a game before logging out but still tries to log out if it doesn't successfully leave the game
            try{
                try{
                    if(gameID){
                        await this.#makeRequest('/play','delete',{ sessionID: sess, gameID: gameID });
                    }
                } catch (error) { 
                    console.error(error); 
                } 
                await this.#makeRequest('/session','delete',{ sessionID: sess });
            } catch (err) {
                console.error(err);
            } finally {
                await (await this.#storage).clear();
            }
        }
    }
    
    // App function requests
    static async login(username:string, deviceID:string){
        console.log(`Logging in user: ${username}`);
        if(username === 'admin' && deviceID === 'admin'){ this.#session = admin.sessionID; return; }
        const body = { username, deviceID };
        const res = await this.#makeRequest('/session','post',body);
        this.#session = res.sessionID;
        (await this.#storage).set('sessionID',res.sessionID);
    }

    static async logout(){
        if(this.#session === admin.sessionID){ this.#session = null; return; }
        const body = { sessionID: this.#session };
        await this.#makeRequest('/session','delete',body);
        this.#session = null;
        (await this.#storage).clear();
    }

    static async createGame(gameName:string, type:any, duration:number, config:any, bounds:string|null){
        if(this.#session === admin.sessionID){ admin.newGame(gameName, type, duration); return; }
        const body = { sessionID: this.#session, gameName, type, duration, config, bounds};
        await this.#makeRequest('/game','put',body);
    }

    static async joinGame(gameID:number){
        if(this.#session === admin.sessionID){ this.#gameID = admin.sessionID; this.gameInfo = admin.gameInfo; return; }
        const body = { sessionID: this.#session, gameID: gameID };
        const res = await this.#makeRequest('/play','put',body);
        this.gameInfo = res.gameData;
        console.log('Game info from join:',this.gameInfo)
        this.#gameID = gameID;
        this.inGame = true;
        (await this.#storage).set('gameID',this.#gameID);
    }

    static async gameComms(){
        if(this.#session === admin.sessionID){ return admin.comms; }
        if(!this.#gameID){ return null; }
        const body = { sessionID: this.#session, gameID: this.#gameID };
        const sendTime = Date.now();
        const res = await this.#makeRequest('/comms','post',body);
        this.currGameComm = res.gameComms;
        this.#currPing = Date.now() - sendTime;
        return res.gameComms;
    }

    static async leaveGame(){
        if(this.#session === admin.sessionID){ this.#gameID = 0; this.gameInfo = admin.gameInfo; return; }
        const body = { sessionID: this.#session, gameID: this.#gameID };
        await this.#makeRequest('/play','delete',body);
        this.#gameID = 0;
        (await this.#storage).remove("gameID");
        this.gameInfo = admin.gameInfo;
        this.inGame = false;
    }

    static async grabGames(){
        if(this.#session === admin.sessionID){ this.#gameList = admin.games; return admin.games; }
        const body = {sessionID: this.#session}
        const response = await this.#makeRequest('/game', 'POST', body);
        this.#gameList = response.gameList;
        return response.gameList;
    }

    static async ready(teamColor:string | null){
        if(this.#session === admin.sessionID){ return; }
        const body = {sessionID: this.#session, gameID: this.#gameID, actionData: {type:"Ready", team: teamColor}};
        await this.#makeRequest('/action', 'POST', body);
    }

    static async getHistory(){
        if(this.#session === admin.sessionID){ return admin.games; }
        const body = {sessionID: this.#session}
        const response = await this.#makeRequest('/history', 'POST', body);
        return response.gameList;
    }

    static async getHistoryInfo(gameID:number){
        if(this.#session === admin.sessionID){ return admin.historyInfo; }
        const body = {sessionID: this.#session, gameID: gameID}
        const response = await this.#makeRequest('/history-info', 'POST', body);
        return response.gameList;
    }

    static async getInventory() {
        const body = {sessionID: this.#session, gameID: this.#gameID};
        const response = await this.#makeRequest('/inventory', 'POST', body);
        return response.inventory;
    }

    // Game related functions
    static async makeDrop(){
        const body = {sessionID: this.#session, gameID: this.#gameID, actionData: {type:"Drop"}};
        await this.#makeRequest('/action', 'POST', body);
    }
    static async pickupDrop(){
        const body = {sessionID: this.#session, gameID: this.#gameID, actionData: {type:"Collect"}};
        await this.#makeRequest('/action', 'POST', body);
    }
    static async placeItem(item:string){
        const body = {sessionID: this.#session, gameID: this.#gameID, actionData: {type:"Place", item}};
        await this.#makeRequest('/action', 'POST', body);
    }

    // Request maker 9000
    static async #makeRequest(path: string, method: string, body: object): Promise<any> {
        axios.defaults.headers.post['Content-Type'] ='application/json';
        // console.log(`Making a ${method} request on path ${path}. Sending`, body);
        let response = null;
        // Sends the request
        await axios({
            method: method,
            url: this.#host + path,
            headers: {
                'Content-Type': 'application/json'
            },
            data: body
        })
        .then((res) => {
            // Happens after the response comes back
            // console.log("Response from server:",res);
            response = res.data;
        })
        .catch((error) => {
            // Handles errors. Passes along error with only the message, or handles unknown errors
            if (error.response) {
                // API error with response
                if (error.response.data && error.response.data.message) {
                    throw new Error(error.response.data.message);
                } else {
                    // Handle unexpected response format
                    throw new Error("An unexpected error occurred. Please try again.");
                }
            } else {
                // Network or other error without response
                throw new Error("An error occurred. Please check your network connection and try again.");
            }
        });
        // Returns the response for parsing
        return response
    }
}

const admin = {
    sessionID: -1,
    games: [{
        game_id: -1,
        game_name: 'Game1',
        game_type: 1,
        game_duration: 5,
        game_config: {},
        created_by: -1,
        time_created: '2024-06-27T20:41:47.833Z',
        game_state: '00000001',
        status_config: null,
        log_time: '2024-06-27T20:41:47.833Z',
        creator: 'admin'
    },{
        game_id: -2,
        game_name: 'Game2',
        game_type: 2,
        game_duration: 8,
        game_config: {},
        created_by: -1,
        time_created: '2024-06-27T20:41:47.833Z',
        game_state: '00000001',
        status_config: null,
        log_time: '2024-06-27T20:41:47.833Z',
        creator: 'admin'
    }],
    newGame: (gameName:string, type:any, duration:number) => {
        admin.games.push({
            game_id: Math.floor(Math.random() * 1000),
            game_name: gameName,
            game_type: type,
            game_duration: duration,
            game_config: {},
            created_by: -1,
            time_created: '2024-06-27T20:41:47.833Z',
            game_state: '00000001',
            status_config: null,
            log_time: '2024-06-27T20:41:47.833Z',
            creator: 'admin'
        });
    },
    gameInfo: {
        "game_id":30,
        "game_name":"Med",
        "game_type":2,
        "game_duration":30,
        "game_config":{"gameMode":"FFO","dropPhase":15,"collectPhase":15,"cameraAmount":20,"cameraRange":{"upper":75,"lower":50}},
        "created_by":44,
        "time_created":"2024-06-28T09:10:58.643Z",
        "game_bounds":"reston-center",
        "game_state_id":64,
        "game_state":"00000001",
        "status_config":null,
        "log_time":"2024-06-28T09:10:58.643Z"
    },
    comms: {
        "gameStatus":"1",
        "gameStatusData":{
            "game_state":"00000001",
            "log_time":"2024-06-28T09:10:58.643Z"
        },
        "playerStatusData":[{
            "username":"admin1",
            "player_state":"00000001",
            "team":'#3f51b5',
            "score":"6",
            "lat":38.9583,
            "long":-77.3572,
            "time_since_geo_log":"13",
            "time_since_comms_log":"2.032000",
            "inBounds":true
        },{
            "username":"admin2",
            "player_state":"00000011",
            "team":'#ff5722',
            "score":"10",
            "lat":38.9587,
            "long":-77.3570,
            "time_since_geo_log":"15.498",
            "time_since_comms_log":"2.032000",
            "inBounds":true
        }]
    },
    historyInfo: [
        {
          player_state_id: 628,
          game_id: 16,
          session_id: 35,
          player_state: '00000100',
          score: '7',
          team: '#8bc34a',
          log_time: '2024-06-27T23:02:15.782Z',
          username: 'admin1'
        },
        {
          player_state_id: 629,
          game_id: 16,
          session_id: 36,
          player_state: '00000100',
          score: '11',
          team: '#e91e63',
          log_time: '2024-06-27T23:02:45.484Z',
          username: 'admin2'
        },
        {
          player_state_id: 630,
          game_id: 16,
          session_id: 37,
          player_state: '00000100',
          score: '69',
          team: '#3f51b5',
          log_time: '2024-06-27T23:02:47.948Z',
          username: 'admin3'
        }
      ]
};