/* Parry Perry, Dreamcast port: saving to the VMU (memory card) over the Maple bus, no KallistiOS. ON-DEMAND ONLY, see ../README.md
 *
 * Block I/O follows the DREAMCAST_PORT_HANDOFF notes (appendix H, taken from KallistiOS hardware/maple/vmu.c): block numbers go out as an
 * encoded id, a block write is four 128 byte messages plus a sync, the card answers writes with OK, and the FAT's free and last-block
 * markers are 0xfffc and 0xfffa. The file system part (root block, FAT, directory, the vmu_pkg header with a 32x32 icon and a CRC) follows
 * the layout in KallistiOS fs/vmufs.c and include/dc/vmu_pkg.h as I remember it; it was checked only against Flycast's virtual card.
 *
 * One file, "PARRYPERRY", 2 blocks: 128 byte header, one 512 byte icon, then 256 bytes of save data (see game.c for the layout). */
#include "dc.h"

#define MAPLE_BASE      0xa05f6c00u
#define MAPLE_DMA_ADDR  (*(volatile u32 *)(MAPLE_BASE + 0x04))
#define MAPLE_STATE     (*(volatile u32 *)(MAPLE_BASE + 0x18))
#define MAPLE_CMD_BREAD  11
#define MAPLE_CMD_BWRITE 12
#define MAPLE_CMD_BSYNC  13
#define MAPLE_RESP_OK    7
#define MAPLE_RESP_DATA  8
#define MAPLE_FUNC_MEM   0x02000000u
#define MAPLE_DEST_VMU   0x01
#define VMU_ROOT_BLOCK   255
#define VMU_FAT_FREE     0xfffcu
#define VMU_FAT_LAST     0xfffau
#define VMU_FILE_DATA    0x33
#define P2(p)   ((volatile u32 *)(((u32)(p)) | 0x20000000u))
#define PHYS(p) (((u32)(p)) & 0x1fffffffu)

static u32 vmu_cmd[160] __attribute__((aligned(32)));
static u32 vmu_resp[160] __attribute__((aligned(32)));

static u16 get_u16(const u8 *p) { return (u16)(p[0] | (p[1] << 8)); }
static void put_u16(u8 *p, u16 v) { p[0] = (u8)(v & 0xff); p[1] = (u8)(v >> 8); }

static int maple_xfer(u32 cmd, u32 nwords, const u32 *words, u32 want) {
    volatile u32 *c = P2(vmu_cmd);
    volatile u32 *r = P2(vmu_resp);
    u32 timeout, i;
    c[0] = nwords | 0x80000000u;            /* data words, port A, last frame */
    c[1] = PHYS(vmu_resp);
    c[2] = cmd | (MAPLE_DEST_VMU << 8) | (0u << 16) | (nwords << 24);
    for(i = 0; i < nwords; i++) c[3 + i] = words[i];
    r[0] = 0xffffffffu;
    MAPLE_DMA_ADDR = PHYS(vmu_cmd);
    MAPLE_STATE = 1;
    for(timeout = 0; timeout < 4000000u; timeout++)
        if(MAPLE_STATE == 0) break;
    if(MAPLE_STATE != 0) return 0;
    return (r[0] & 0xffu) == want;
}
static u32 vmu_blkid(u16 blk, u32 phase) { return ((u32)(blk & 0xff) << 24) | ((u32)(blk >> 8) << 16) | (phase << 8); }

static int vmu_read_block(u16 blk, u8 *out) {
    u32 w[2];
    volatile u32 *r = P2(vmu_resp);
    int i;
    w[0] = MAPLE_FUNC_MEM;
    w[1] = vmu_blkid(blk, 0);
    if(!maple_xfer(MAPLE_CMD_BREAD, 2, w, MAPLE_RESP_DATA)) return 0;
    if(r[1] != MAPLE_FUNC_MEM || r[2] != w[1]) return 0;
    for(i = 0; i < 128; i++) {
        u32 v = r[3 + i];
        out[i * 4 + 0] = (u8)(v & 0xff); out[i * 4 + 1] = (u8)((v >> 8) & 0xff);
        out[i * 4 + 2] = (u8)((v >> 16) & 0xff); out[i * 4 + 3] = (u8)((v >> 24) & 0xff);
    }
    return 1;
}
static int vmu_write_block_once(u16 blk, const u8 *in) {
    u32 w[2 + 32], phase;
    int i;
    for(phase = 0; phase < 4; phase++) {
        const u8 *src = in + phase * 128;
        w[0] = MAPLE_FUNC_MEM;
        w[1] = vmu_blkid(blk, phase);
        for(i = 0; i < 32; i++) w[2 + i] = (u32)src[i * 4] | ((u32)src[i * 4 + 1] << 8) | ((u32)src[i * 4 + 2] << 16) | ((u32)src[i * 4 + 3] << 24);
        if(!maple_xfer(MAPLE_CMD_BWRITE, 2 + 32, w, MAPLE_RESP_OK)) return 0;
    }
    w[0] = MAPLE_FUNC_MEM;
    w[1] = vmu_blkid(blk, 4);
    return maple_xfer(MAPLE_CMD_BSYNC, 2, w, MAPLE_RESP_OK);
}
static int vmu_write_block(u16 blk, const u8 *in) {      /* real cards are sometimes busy right after a write; KOS retries too */
    int tries;
    for(tries = 0; tries < 3; tries++) if(vmu_write_block_once(blk, in)) return 1;
    return 0;
}

/* ---- the file system */
static u8 rootb[512], fatb[512], dirb[512], bufa[512], bufb[512];
static u16 fat_loc, dir_loc, dir_size;
static const char FILE_NAME[12] = "PARRYPERRY";

static int open_card(void) {
    int i;
    if(!vmu_read_block(VMU_ROOT_BLOCK, rootb)) return 0;
    for(i = 0; i < 16; i++) if(rootb[i] != 0x55) return 0;            /* an unformatted card */
    fat_loc = get_u16(rootb + 70); dir_loc = get_u16(rootb + 74); dir_size = get_u16(rootb + 76);
    if(fat_loc > 255 || dir_loc > 255 || dir_size == 0 || dir_size > 32) return 0;
    return vmu_read_block(fat_loc, fatb);
}
/* find our entry (match 1) or the first free one (match 0); returns the directory block number, sets *idx */
static int find_entry(int match, int *idx) {
    u16 b;
    int e;
    for(b = 0; b < dir_size; b++) {
        if(!vmu_read_block((u16)(dir_loc - b), dirb)) return -1;
        for(e = 0; e < 16; e++) {
            const u8 *d = dirb + e * 32;
            int k, same = 1;
            if(match) {
                if(d[0] != VMU_FILE_DATA) continue;
                for(k = 0; k < 12; k++) if(d[4 + k] != (u8)FILE_NAME[k]) same = 0;
                if(!same) continue;
            } else if(d[0] != 0) continue;
            *idx = e;
            return dir_loc - b;
        }
    }
    return -1;
}

static u16 crc16(const u8 *buf, int size) {
    int i, c, n = 0;
    for(i = 0; i < size; i++) { n ^= (buf[i] << 8); for(c = 0; c < 8; c++) n = (n & 0x8000) ? ((n << 1) ^ 4129) : (n << 1); }
    return (u16)(n & 0xffff);
}

/* the package: header (128 bytes), one 32x32 16 colour icon (512), the data; two blocks */
#define PKG_HDR 128
#define PKG_ICON 512
#define PKG_LEN (PKG_HDR + PKG_ICON + 256)
static void build_pkg(u8 *p, const u8 *data) {                  /* p is 1024 bytes */
    int i, x, y;
    static const char sd[16] = "Parry Perry    ", app[16] = "ParryPerry";
    for(i = 0; i < 1024; i++) p[i] = 0;
    for(i = 0; i < 16; i++) p[i] = (u8)sd[i];
    { const char *ld = "Parry Perry progress"; for(i = 0; i < 32; i++) p[16 + i] = i < 20 ? (u8)ld[i] : ' '; }
    for(i = 0; i < 16; i++) p[48 + i] = (u8)app[i];
    put_u16(p + 64, 1);                                         /* one icon frame */
    put_u16(p + 66, 0); put_u16(p + 68, 0);                     /* no animation, no eyecatch */
    p[72] = 0; p[73] = 1; p[74] = 0; p[75] = 0;                 /* data_len = 256 (little endian u32) */
    put_u16(p + 96, 0x0000);                                    /* palette at 96: 0 transparent, 1 dark, 2 gold, 3 light gold (ARGB4444) */
    put_u16(p + 98, 0xf321); put_u16(p + 100, 0xffc3); put_u16(p + 102, 0xffec);
    for(y = 0; y < 32; y++) for(x = 0; x < 16; x++) {           /* a gold diamond with a dark rim, left-right symmetric so the nibble order does not matter */
        int dx = (x < 16 ? 15 - x : x - 16), dy = (y < 16 ? 15 - y : y - 16), d = dx + dy, v = d < 6 ? 3 : d < 12 ? 2 : d < 14 ? 1 : 0;
        p[PKG_HDR + y * 16 + x] = (u8)((v << 4) | v);
    }
    for(i = 0; i < 256; i++) p[PKG_HDR + PKG_ICON + i] = data[i];
    put_u16(p + 70, crc16(p, PKG_LEN));                         /* the crc field is zero while it is computed */
}

int save_read(u8 *data256) {                                    /* 1 when a valid save was read into data256, 0 when none, -1 when there is no card */
    int idx, db, i;
    u16 a, b;
    if(!open_card()) return -1;
    db = find_entry(1, &idx);
    if(db < 0) return 0;
    a = get_u16(dirb + idx * 32 + 2);
    if(a > 199) return 0;
    b = get_u16(fatb + a * 2);
    if(b > 199) return 0;
    if(!vmu_read_block(a, bufa) || !vmu_read_block(b, bufb)) return -1;
    for(i = 0; i < 256; i++) {
        int off = PKG_HDR + PKG_ICON + i;
        data256[i] = off < 512 ? bufa[off] : bufb[off - 512];
    }
    return 1;
}

int save_write(const u8 *data256) {                             /* 1 on success */
    static u8 pkg[1024];
    int idx, db, e, nfree = 0;
    u16 a = 0, b = 0, f;
    if(!open_card()) return 0;
    build_pkg(pkg, data256);
    db = find_entry(1, &idx);
    if(db >= 0) {                                               /* replace the file we wrote before, in the same blocks when it is 2 long */
        a = get_u16(dirb + idx * 32 + 2);
        if(a <= 199 && get_u16(fatb + a * 2) <= 199 && get_u16(fatb + get_u16(fatb + a * 2) * 2) == VMU_FAT_LAST) b = get_u16(fatb + a * 2);
        else db = -1;
    }
    if(db < 0) {                                                /* a new file: two free blocks, and a free directory entry */
        for(f = 0; f < 200 && nfree < 2; f++) if(get_u16(fatb + f * 2) == VMU_FAT_FREE) { if(nfree == 0) a = f; else b = f; nfree++; }
        if(nfree < 2) return 0;
        db = find_entry(0, &idx);
        if(db < 0) return 0;
        put_u16(fatb + a * 2, b); put_u16(fatb + b * 2, VMU_FAT_LAST);
    }
    if(!vmu_write_block(a, pkg) || !vmu_write_block(b, pkg + 512)) return 0;
    if(!vmu_write_block(fat_loc, fatb)) return 0;
    if(!vmu_read_block((u16)db, dirb)) return 0;
    {
        u8 *d = dirb + idx * 32;
        for(e = 0; e < 32; e++) d[e] = 0;
        d[0] = VMU_FILE_DATA; d[1] = 0; put_u16(d + 2, a);
        for(e = 0; e < 12; e++) d[4 + e] = (u8)FILE_NAME[e];
        d[16] = 0x20; d[17] = 0x26; d[18] = 0x10; d[19] = 0x02;      /* a fixed BCD timestamp: there is no clock to read */
        put_u16(d + 24, 2); put_u16(d + 26, 0);
    }
    return vmu_write_block((u16)db, dirb);
}
