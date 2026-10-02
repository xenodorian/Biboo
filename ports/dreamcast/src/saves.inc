/* ------------------------------------------------------------------ the frame */

/* ------------------------------------------------------------------ saves (the progress that web/progress.js keeps: levels, leaves, ankhs, max HP) */
static const char *save_msg = "";
static float save_msg_until;
static void save_pack(u8 *d) {                  /* a fixed 256 byte record: magic, version, fields, then a checksum of the first 254 bytes */
    int i;
    u16 sum = 0;
    for(i = 0; i < 256; i++) d[i] = 0;
    d[0] = 'P'; d[1] = 'P'; d[2] = 'R'; d[3] = 'Y'; d[4] = 1;
    d[5] = (u8)levels_unlocked; d[6] = cleared;
    d[8] = (u8)(leaves & 0xff); d[9] = (u8)(leaves >> 8);
    d[10] = (u8)(ankhs & 0xff); d[11] = (u8)(ankhs >> 8);
    d[12] = (u8)(int)max_hp; d[13] = (u8)((int)max_hp >> 8);
    for(i = 0; i < 254; i++) sum = (u16)(sum + d[i]);
    d[254] = (u8)(sum & 0xff); d[255] = (u8)(sum >> 8);
}
static int save_unpack(const u8 *d) {
    int i;
    u16 sum = 0;
    if(d[0] != 'P' || d[1] != 'P' || d[2] != 'R' || d[3] != 'Y' || d[4] != 1) return 0;
    for(i = 0; i < 254; i++) sum = (u16)(sum + d[i]);
    if(d[254] != (u8)(sum & 0xff) || d[255] != (u8)(sum >> 8)) return 0;
    levels_unlocked = d[5] < 1 ? 1 : d[5] > NUM_LEVELS ? NUM_LEVELS : d[5]; cleared = d[6];
    leaves = d[8] | (d[9] << 8); ankhs = d[10] | (d[11] << 8); max_hp = (float)(d[12] | (d[13] << 8));
    if(max_hp < MAX_HP_START) max_hp = MAX_HP_START; else if(max_hp > 200.0f) max_hp = 200.0f;
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
    if(r == 1 && save_unpack(d)) save_msg = "SAVE LOADED";
    else save_msg = r < 0 ? "NO MEMORY CARD" : "NEW GAME";
    save_msg_until = now + 4000.0f;
}

