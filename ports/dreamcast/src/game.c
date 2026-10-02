/* Parry Perry, Dreamcast port: the game. Ported from web/game/. ON-DEMAND ONLY, see ../README.md
 *
 * One translation unit, kept as several .inc files in the order they depend on each other. The move, enemy and map tables are generated
 * from the web data (tools/bake_game.py). Coordinates are the web game's ("view" pixels, 384x216, y up from the ground); only drawing
 * converts to screen pixels (5/6 size). */
#include "dc.h"
#include "gen/game_data.h"
#include "gen/music_data.h"

#define FRAME_MS 16.6667f

#include "state.inc"
#include "surfaces.inc"
#include "player.inc"
#include "body.inc"
#include "enemy.inc"
#include "combat.inc"
#include "world.inc"
#include "maps.inc"
#include "health.inc"
#include "draw.inc"
#include "saves.inc"
#include "screens.inc"
