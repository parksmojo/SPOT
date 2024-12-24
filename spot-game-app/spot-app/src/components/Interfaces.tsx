export interface gameComms {
  gameStatusData: GameStatusData,
  playerStatusData: PlayerStatusData[]
}
export interface GameStatusData {
  cameras: GameCameras[],
  dropData: DropData[],
  placed_items: Item[],
  created_by: number,
  game_bounds: string,
  game_config: Object,
  game_duration: number,
  game_id: number,
  game_name: string,
  game_state: string,
  game_type: number,
  log_time: string,
  status_config: Object,
  time_created: string,
  time_started: string
}

interface Item {
  object_id: number,
  session_id: number,
  game_id: number,
  lat: number,
  long: number,
  log_time: string,
  object_position: string,
  object_state: string,
  object_type: string,
  config: object,
  status_config: object
}
export interface GameCameras {
  camera_id: number;
  camera_status: string,
  camera_diameter: number,
  camera_duration: number,
  lat: number,
  long: number
}
export interface DropData {
  status_config: ObjStatusConfig,
  game_id: number,
  lat: number,
  long: number,
  object_id: number,
  object_type: string,
  session_id: number,
  object_state: string
}
export interface ObjStatusConfig {
  Collector: number,
  Safe: number
}
export interface PlayerStatusData {
  session_id: number;
  username: string,
  player_state: string,
  score: number,
  comm_interval: number | null,
  lat: number,
  long: number,
  team: string,
  inBounds: boolean,
  inventory: inventoryItem[]
}
export interface cameraInfo {
  camera_id: number;
  camera_status: string,
  camera_diameter: number,
  camera_duration: number,
  lat: number,
  long: number
}

export interface inventoryItem{
  inv_id: number,
  session_id: number,
  game_id: number,
  object_id: number,
  config: any,
  object_position: any,
  object_state: string,
  object_type: string,
}

export interface gameInfo {
  game_id: number,
  game_name: string,
  game_type: number,
  game_duration: number,
  game_config: string, // Change this later if we try to access it
  created_by: number,
  time_created: string,
  game_bounds: string,
  game_state_id: number,
  game_state: string,
  status_config: object,
  log_time: string
}