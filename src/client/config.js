const config = {
    copOverrideChance: 0,       // Turn local population NPC's into cops?
    flameOn: false,             // Flame effect following vehicles at speed
    pedsHostile: false,         // Start turning all NPCs hostile towards the player?
    pedsOn: true,               // Disable population NPC spawning completely, won't despawn any that already exist
    flameTimeout: 10000,        // Millis for each spawned flame to last, before we despawn them
    flameMinSpeed: 10,          // Minimum player speed for flames to be spawned
    hatedGroups: [
        'AMBIENT_GANG_BALLAS',
        'AMBIENT_GANG_CULT',
        'AMBIENT_GANG_FAMILY',
        'AMBIENT_GANG_LOST',
        'AMBIENT_GANG_MARABUNTE',
        'AMBIENT_GANG_MEXICAN',
        'AMBIENT_GANG_SALVA',
        'AMBIENT_GANG_WEICHENG',
        'AMBIENT_GANG_HILLBILLY',
    ]
};

export default config;
