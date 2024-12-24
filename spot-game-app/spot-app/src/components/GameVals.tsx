import { GameStatusData, PlayerStatusData, gameComms } from "./Interfaces";

export class GameVals {
    static readonly KING_OF_THE_HILL = 1;
    static readonly DEAD_DROP = 2;
    static readonly CHASE_THE_RABBIT = 3;
    static readonly CAPTURE_THE_FLAG = 4;
    static readonly LAST_INTERN_STANDING = 5;

    // Dead Drop values
    static readonly DD_STARTING_PLAYER_RANGE = 0.00015;
    static readonly DD_DROP_DELAY = 10;
    static readonly DD_COLLECT_DELAY = 5;
    static readonly DD_CAMERA_AMOUNT_MIN = 10;
    static readonly DD_CAMERA_AMOUNT_MAX = 30;
    static readonly DD_CAMERA_RANGE_MIN = 20; // This is a percentage of the camera-specific range
    static readonly DD_CAMERA_DURATION_MIN = 15;
    static readonly DD_CAMERA_DURATION_MAX = 300;
    // Easy Mode
    static readonly DD_EZ_CAMERA_AMOUNT = this.DD_CAMERA_AMOUNT_MIN;
    static readonly DD_EZ_CAMERA_RANGE = {lower:this.DD_CAMERA_RANGE_MIN,upper:50};
    static readonly DD_EZ_CAMERA_DURATION = {lower:this.DD_CAMERA_DURATION_MIN,upper:60};
    // Intermediate mode
    static readonly DD_MED_CAMERA_AMOUNT = 20;
    static readonly DD_MED_CAMERA_RANGE = {lower:50,upper:75};
    static readonly DD_MED_CAMERA_DURATION = {lower:60,upper:200};
    // Hard mode
    static readonly DD_HARD_CAMERA_AMOUNT = this.DD_CAMERA_AMOUNT_MAX;
    static readonly DD_HARD_CAMERA_RANGE = {lower:75,upper:100};
    static readonly DD_HARD_CAMERA_DURATION = {lower:200,upper:this.DD_CAMERA_DURATION_MAX};

    // Chase the Rabbit values
    static readonly CR_STARTING_PLAYER_RANGE = 0.001;

    // Default game comm
    static baseGSD : GameStatusData = {
        cameras: [],
        dropData: [],
        placed_items: [],
        created_by: 0,
        game_bounds: '',
        game_config: {},
        game_duration: 0,
        game_id: 0,
        game_name: '',
        game_state: '',
        game_type: 0,
        log_time: '',
        status_config: [],
        time_created: '',
        time_started: ''
    }

    static basePSD : PlayerStatusData = {
        session_id: 0,
        username: '',
        player_state: '',
        score: 0,
        comm_interval: null,
        lat: 0,
        long: 0,
        team: '',
        inBounds: false,
        inventory: []
      }

    static baseComm : gameComms = {
        gameStatusData : this.baseGSD,
        playerStatusData : [this.basePSD]
    }
}