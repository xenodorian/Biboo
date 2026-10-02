/* ------------------------------------------------------------------ the frame */

/* ------------------------------------------------------------------ saves (the progress that web/progress.js keeps) */
static const char *save_msg = "";
static float save_msg_until;
static void reset_progress(void) {
    int i;
    unlocked = 0; recompute_unlocks();
    for(i = 0; i < 4; i++) gem_bag[i] = 0;
    meter[0] = meter[1] = meter[2] = 0;
    meter_max[0] = 50; meter_max[1] = 50; meter_max[2] = 100;
    max_hp = MAX_HP_START; hp = max_hp;
    ankhs = 3; leaves = 100;
    levels_unlocked = 1; cleared = 0;
    story_double = story_ending = 0; story_at = 0;
#ifdef UNLOCK_ALL
    unlocked = (1u << UL_COUNT) - 1; recompute_unlocks();
    meter[0] = meter_max[0]; meter[1] = meter_max[1]; meter[2] = meter_max[2];
#endif
}
static void save_pack(u8 *d) {                  /* 256 bytes: magic, version 2, fields, checksum of the first 254 */
    int i;
    u16 sum = 0;
    for(i = 0; i < 256; i++) d[i] = 0;
    d[0] = 'P'; d[1] = 'P'; d[2] = 'R'; d[3] = 'Y'; d[4] = 2;
    d[5] = (u8)levels_unlocked; d[6] = cleared;
    d[7] = (u8)((story_double ? 1 : 0) | (story_ending ? 2 : 0));
    d[8] = (u8)(leaves & 0xff); d[9] = (u8)(leaves >> 8);
    d[10] = (u8)(ankhs & 0xff); d[11] = (u8)(ankhs >> 8);
    d[12] = (u8)(int)max_hp; d[13] = (u8)((int)max_hp >> 8);
    d[14] = (u8)unlocked; d[15] = (u8)(unlocked >> 8); d[16] = (u8)(unlocked >> 16); d[17] = (u8)(unlocked >> 24);
    for(i = 0; i < 4; i++) d[18 + i] = (u8)gem_bag[i];
    for(i = 0; i < 3; i++) { d[22 + i] = (u8)meter[i]; d[25 + i] = (u8)meter_max[i]; }
    for(i = 0; i < 254; i++) sum = (u16)(sum + d[i]);
    d[254] = (u8)(sum & 0xff); d[255] = (u8)(sum >> 8);
}
static int save_unpack(const u8 *d) {
    int i;
    u16 sum = 0;
    if(d[0] != 'P' || d[1] != 'P' || d[2] != 'R' || d[3] != 'Y') return 0;
    if(d[4] != 1 && d[4] != 2) return 0;
    for(i = 0; i < 254; i++) sum = (u16)(sum + d[i]);
    if(d[254] != (u8)(sum & 0xff) || d[255] != (u8)(sum >> 8)) return 0;
    levels_unlocked = d[5] < 1 ? 1 : d[5] > NUM_LEVELS ? NUM_LEVELS : d[5]; cleared = d[6];
    leaves = d[8] | (d[9] << 8); ankhs = d[10] | (d[11] << 8); max_hp = (float)(d[12] | (d[13] << 8));
    if(max_hp < MAX_HP_START) max_hp = MAX_HP_START; else if(max_hp > 200.0f) max_hp = 200.0f;
    if(d[4] == 2) {
        story_double = (d[7] & 1) != 0; story_ending = (d[7] & 2) != 0;
        unlocked = (u32)d[14] | ((u32)d[15] << 8) | ((u32)d[16] << 16) | ((u32)d[17] << 24);
        if(UL_COUNT < 32) unlocked &= (1u << UL_COUNT) - 1;
        for(i = 0; i < 4; i++) gem_bag[i] = d[18 + i] > MAX_GEM_BAG ? MAX_GEM_BAG : d[18 + i];
        for(i = 0; i < 3; i++) {
            meter_max[i] = d[25 + i] < (i == 2 ? 100 : 50) ? (i == 2 ? 100 : 50) : d[25 + i] > 200 ? 200 : d[25 + i];
            meter[i] = d[22 + i]; if(meter[i] > meter_max[i]) meter[i] = meter_max[i];
        }
    }
    recompute_unlocks();
    hp = max_hp;
    return 1;
}
static void save_game(void) {
    u8 d[256];
    save_pack(d);
    save_msg = save_write(d) ? "SAVED TO THE MEMORY CARD" : "COULD NOT SAVE (NO CARD?)"; save_msg_until = now + 2500.0f;
}
static void load_game(void) {
    u8 d[256];
    int r = save_read(d);
    if(r == 1 && save_unpack(d)) { has_save = 1; save_msg = "SAVE LOADED"; }
    else { has_save = 0; save_msg = r < 0 ? "NO MEMORY CARD" : "NEW GAME"; }
    save_msg_until = now + 4000.0f;
}

