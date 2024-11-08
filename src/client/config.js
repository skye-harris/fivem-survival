const config = {
    copOverrideChance: 0,       // Turn local population NPC's into cops?
    flameOn: false,             // Flame effect following vehicles at speed
    pedsHostile: false,         // Start turning all NPCs hostile towards the player?
    pedsOn: true,               // Disable population NPC spawning completely, won't despawn any that already exist
    flameTimeout: 10000,        // Millis for each spawned flame to last, before we despawn them
    flameMinSpeed: 10,          // Minimum player speed for flames to be spawned
};

export default config;
