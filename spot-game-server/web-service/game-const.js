class GameConsts {
  static get SESSION_CLEANUP_THRESHOLD(){ return '30 minutes'; }
  static get GAME_CLEANUP_THRESHOLD(){ return '6 hours'; }

  static get KING_OF_THE_HILL(){ return 1; };
  static get DEAD_DROP(){ return 2; };
  static get CHASE_THE_RABBIT(){ return 3; };
  static get CAPTURE_THE_FLAG(){ return 4; };
  static get LAST_INTERN_STANDING(){ return 5; };

  // Dead Drop Values
  static get DD_DROP_DELAY(){ return 10; }; // Must match delay found in GameVals.tsx on client side
  static get DD_COLLECT_DELAY(){ return 5; }; // Must match delay found in GameVals.tsx on client side
  static get DD_MOVEMENT_THRESHOLD(){ return 0.00015; };
  static get DD_PICKUP_DIST_THRESHOLD(){ return 0.00015; };
  static get DD_SAFE_DIST_THRESHOLD(){ return 0.00015; };
  static get DD_DIST_TO_SCORE_MULTIPLIER(){ return 20000; };
  static get DD_NO_DROP_PENALTY(){ return -10; };
  static get DD_MAX_SAFE_ZONE_POINTS(){ return 60; }; // points for first person reaching safe zone
  static get DD_SAFE_ZONE_POINT_DECAY(){ return 0.5; }; // points lost every second from baseSafeZonePoints

  // Chase the Rabbit values
  // Time in seconds
  static get CR_POINT_PELLET_INTERVAL(){ return 30; };
  static get CR_GAIN_LANDMINE_INTERVAL(){ return 60; };
  static get CR_GAIN_TRAP_INTERVAL(){ return 60; };
  // Points
  static get CR_POINT_PELLET_DROP_VALUE(){ return 10; };
  static get CR_POINT_PELLET_COLLECT_VALUE(){ return this.CR_POINT_PELLET_DROP_VALUE / 2; };
  static get CR_LANDMINE_SCORE_PENALTY(){ return 30; }; // 3x the pellet value
  static get CR_CAPTURE_BONUS(){ return 50; };
  // Distance
  static get CR_PELLET_TOUCH_DIST(){ return 0.00015; };
  static get CR_LANDMINE_TOUCH_DIST(){ return 0.00015; };
  static get CR_TRAP_TOUCH_DIST(){ return 0.00015; };
  // Inventory size
  static get CR_RABBIT_INVENTORY_CAPACITY(){ return 3; };
  static get CR_FOX_INVENTORY_CAPACITY(){ return 2; };
  // Probability values
  static get CR_PELLET_DROP_PROB() { return 150; };
  
  // Capture the Flag values
  static get CF_TAG_DIST(){ return 0.00015}
}

exports.GameConsts = GameConsts;