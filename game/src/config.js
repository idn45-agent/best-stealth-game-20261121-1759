// Level layouts and tuning for Lumen Heist.
//
// Tiles: '#' wall, '.' floor, 'C' display case (blocks sight and movement),
// 'B' shrub (hides the thief inside it), 's' shadow floor (detection is slow),
// 'P' thief start, 'R' the relic, 'X' exit, 'L' loot coin.
//
// Tuning notes, learned from play-testing v1 and v2:
// - Detection decays fast (DETECT_DECAY) so a thief who breaks line of sight
//   gets a real chance to recover instead of being chased forever.
// - A guard that only glimpsed the thief (meter in the suspicious band) walks
//   over to look, searches, then goes back to patrol: a near miss raises the
//   alarm without ending the run.
// - One guard's alarm calls nearby watchmen over (GUARD_ALERT_RADIUS), so
//   getting spotted in a crowd is worse than getting spotted alone.
// - v3: every hall now teaches the shadow rule in its first minutes — a dark
//   patch sits on a patrol lane and another guards the relic approach — and
//   each relic has a bush nearby, so the last stretch always offers cover.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 19;
export const VIEW_WIDTH = COLS * TILE;
export const VIEW_HEIGHT = ROWS * TILE;

export const PLAYER_SPEED = 132;
export const PLAYER_SNEAK_SPEED = 68;
export const PLAYER_RUN_SPEED = 196;
export const GUARD_SPEED = 62;
export const GUARD_CHASE_SPEED = 148;
export const GUARD_VIEW_RANGE = 186;
export const GUARD_VIEW_HALF_ANGLE = 0.63;
export const DETECT_BASE = 62;
export const DETECT_FAR = 26;
export const DETECT_DECAY = 42;
export const SUSPICIOUS_AT = 34;
export const GUARD_ALERT_RADIUS = 280;
export const GUARD_SEARCH_TIME = 2.5;
export const GUARD_CHASE_MEMORY = 4;
export const NOISE_RUN_RADIUS = 96;
export const NOISE_PEBBLE_RADIUS = 118;
export const PEBBLE_COUNT = 5;
export const PEBBLE_COOLDOWN = 0.3;
export const FOOTSTEP_TTL = 0.9;
export const FOOTSTEP_SPACING = 46;
export const LEVEL_INTRO_TIME = 3;
export const LIVES = 3;

export const LEVELS = [
  {
    name: 'I — The Quiet Gallery',
    hint: 'Steal the Moon Opal, then slip out the green door. Bushes hide you; cases block sight; dark floor slows a guard’s gaze.',
    map: [
      '##############################',
      '#P....B......#......L........#',
      '#...ss.......#...............#',
      '#............#...............#',
      '#....C...C...................#',
      '#............#.......BC.C....#',
      '#............#...............#',
      '#..L.........#..C............#',
      '#............#...........B...#',
      '#####...######...#############',
      '#............#...............#',
      '#.....C......#...............#',
      '#..B.........#....ss.........#',
      '#.L.......C..#......R...L....#',
      '#....................BC......#',
      '#.....C......#...............#',
      '#............#...............#',
      '#....L....B..#.............X.#',
      '##############################',
    ],
    guards: [
      { x: 4, y: 2, waypoints: [[4, 2], [11, 2], [11, 6], [4, 6]] },
      { x: 21, y: 3, waypoints: [[21, 4], [26, 4], [26, 6], [21, 6]] },
      { x: 19, y: 12, waypoints: [[19, 12], [19, 16], [26, 16], [26, 12]] },
    ],
  },
  {
    name: 'II — The Vault Hall',
    hint: 'Shadows slow a guard’s gaze. Walk, do not run, through the dark.',
    map: [
      '##############################',
      '#P........L..#...............#',
      '#..sss.......#....ssss.......#',
      '#..s.........................#',
      '#.....C...C..#..........C....#',
      '#..B.sss.....#..........B....#',
      '#.........C..#....ssss.......#',
      '#............#...............#',
      '#..L.........#..........L....#',
      '######....###....#############',
      '#............#...............#',
      '#............#..........B....#',
      '#....ssss....#...............#',
      '#..B.........#.....sssR.B....#',
      '#.....C......#....C..........#',
      '#..L.............ssss...CL...#',
      '#....ssss....#...............#',
      '#.........B..#...B.......X...#',
      '##############################',
    ],
    guards: [
      { x: 3, y: 2, waypoints: [[3, 2], [11, 2], [11, 7], [3, 7]] },
      { x: 18, y: 3, waypoints: [[18, 3], [26, 3], [26, 7], [18, 7]] },
      { x: 4, y: 12, waypoints: [[4, 12], [10, 12], [10, 16], [4, 16]] },
      { x: 20, y: 11, waypoints: [[20, 11], [26, 11], [26, 16], [20, 16]] },
    ],
  },
  {
    name: 'III — The Rooftop Garden',
    hint: 'Five watchmen, one opal. Throw a pebble to pull a guard away.',
    map: [
      '##############################',
      '#P....B......#......B...L....#',
      '#.........B..#..........B....#',
      '#.....C......#...C...........#',
      '#.......................C....#',
      '#..B......C..#....B..........#',
      '#.......B....#..........B....#',
      '#.......ss...#...............#',
      '#..B....B....#....Bssss......#',
      '#####...#####...##############',
      '#............#...............#',
      '#............#....B..........#',
      '#..B....B....#...ssss...B....#',
      '#.L...C......#...CR..B...L...#',
      '#..B.....C..............C....#',
      '#.......B....#...ssss........#',
      '#..L.........#..........B....#',
      '#.....C...B..#......B....X...#',
      '##############################',
    ],
    guards: [
      { x: 3, y: 2, waypoints: [[3, 2], [11, 2], [11, 6], [3, 6]] },
      { x: 19, y: 2, waypoints: [[19, 2], [27, 2], [27, 7], [19, 7]] },
      { x: 4, y: 12, waypoints: [[4, 12], [10, 12], [10, 16], [4, 16]] },
      { x: 19, y: 12, waypoints: [[19, 12], [25, 12], [25, 15], [19, 15]] },
      { x: 17, y: 4, waypoints: [[17, 4], [23, 4], [23, 8], [17, 8]] },
    ],
  },
];
