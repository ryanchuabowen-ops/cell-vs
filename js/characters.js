const CHARACTERS = {
  macrophage: {
    id: 'macrophage', name: 'Macrophage', side: 'immune',
    color: '#4fd1ff', dark: '#1b6e86', shape: 'blob',
    radius: 22, speed: 178, maxHp: 240, regen: 0.02,
    shield: { max: 85, regenDelay: 3, regenRate: 30 },
    blurb: 'A tanky devourer that swells up and swallows pathogens whole, agar.io-style. Contact-based and mostly automatic: it bites anything it touches, and your only real decision is when to trigger Engulf Surge. A rechargeable shield and real foot speed help it actually close the distance. The first time it touches an allied T-Cell each life, its shield capacity doubles -- once that doubled shield is depleted, it caps back at normal.',
    primary: {
      name: 'Engulf Surge', type: 'self_buff_devour', cooldown: 9,
      duration: 7, sizeMult: 3, speedMult: 1.7,
      desc: 'Grows to 3x size and accelerates for 7s. Touching an enemy while active devours it instantly. Recharges quickly -- but it is still just the one deliberate decision you make, not your whole kit.'
    },
    secondary: {
      name: 'Phagocytose', type: 'melee_bite', cooldown: 0.2, auto: true,
      range: 55,
      desc: 'Automatically triggers on any enemy that wanders within reach -- no button press needed. The Macrophage stretches out a pseudopod arm and, the instant it connects, engulfs the target whole -- an instant kill, fast enough to matter even outside Engulf Surge.'
    }
  },
  neutrophil: {
    id: 'neutrophil', name: 'Neutrophil', side: 'immune',
    color: '#9fffb0', dark: '#2c7a3d', shape: 'multilobe',
    radius: 16, speed: 195, maxHp: 100,
    blurb: 'Fast skirmisher that lays sticky NET traps and sprays antimicrobial toxin.',
    primary: {
      name: 'NETosis', type: 'net_trap', cooldown: 0.5,
      range: 160, radius: 42, hazardLife: 8, killCap: 3, maxActive: 3,
      tickDamage: 9, tickInterval: 0.4, slow: 0.5,
      desc: 'Launches a sticky net. Enemies inside are slowed and damaged. Fire up to 3 in quick succession -- once all 3 are down, wait for one to expire before dropping more.'
    },
    secondary: {
      name: 'Toxin Spray', type: 'projectile', cooldown: 0.09, shape: 'dart',
      speed: 560, damage: 9, life: 1.1, radius: 5,
      desc: 'Rapid-fire antimicrobial toxin darts -- a simple linear projectile. Unlimited ammo.'
    }
  },
  bcell: {
    id: 'bcell', name: 'Plasma / B-Cell', side: 'immune',
    color: '#c9a7ff', dark: '#6a4a9e', shape: 'eccentric',
    radius: 17, speed: 165, maxHp: 95,
    blurb: 'Ranged antibody artillery that blankets an area or shotguns a lane.',
    primary: {
      name: 'Antibody Barrage', type: 'radial_projectile', cooldown: 11, shape: 'antibody',
      count: 28, speed: 420, damage: 15, life: 1.3, radius: 5,
      desc: 'A starburst of 28 antibodies all at once in a full 360 around the B-Cell -- a devastating one-shot nova for a kamikaze dive into a crowd, but a long recharge after.'
    },
    secondary: {
      name: 'IgG Shotgun', type: 'shotgun_projectile', cooldown: 0.3, shape: 'antibody',
      count: 5, spread: 0.5, speed: 480, damage: 9, life: 0.9, radius: 5,
      desc: 'A forward spread of antibodies. Unlimited ammo, but a slower rate of fire than the Neutrophil secondaries.'
    }
  },
  tcell: {
    id: 'tcell', name: 'T Cell', side: 'immune',
    color: '#ff8f6b', dark: '#8a3a1f', shape: 'tcell',
    radius: 17, speed: 190, maxHp: 115, regen: 0.03,
    blurb: 'Pure support specialist -- no general-purpose weapon of its own, just a passive aura that heals or recharges whoever it sticks close to, and a large area-denial poison zone that unlocks once your team is halfway to winning. Self-sustains with its own regen, so it never has to retreat to spawn to keep healing others.',
    primary: {
      name: 'Apoptosis', type: 'poison_zone', cooldown: 16, shape: 'cloud',
      range: 280, radius: 190, hazardLife: 6, killCap: Infinity, tickDamage: 9, tickInterval: 0.5,
      desc: 'Locked out until your team has racked up half the kills needed to win. Drops a large, irregularly-shaped poison zone big enough to deny an entire entrance or chokepoint. A damage-over-time area tool, not a quick kill: a long recharge keeps it from becoming a free kill every few seconds.'
    },
    secondary: {
      name: 'Rapid Healing', type: 'heal_aura', cooldown: 0.33, auto: true,
      radius: 75, healFraction: 0.05, supportWindow: 5, touchBuffer: 22,
      desc: 'Passive -- any ally that gets close is steadily healed, and one that gets right up against the T-Cell is healed to full instantly. Always active, no input needed. A healed ally who kills or deals damage soon after credits the T-Cell with an assist and a cut of the damage.'
    }
  },
  bacterium: {
    id: 'bacterium', name: 'Anthrax', side: 'pathogen',
    color: '#ff6b6b', dark: '#8c2626', shape: 'rod',
    radius: 20, speed: 140, maxHp: 170, regen: 0.02,
    blurb: 'Slow bacterium with an overwhelming lethal toxin and a reliable poke. Tanky and slowly self-repairing, the pathogen answer to the Macrophage.',
    primary: {
      name: 'Lethal Toxin', type: 'nuke_projectile', cooldown: 15, shape: 'rod',
      speed: 320, life: 2.2, radius: 10, aoe: 75, instaKill: true,
      desc: 'One devastating shot that detonates on anything -- walls, obstacles, or a target. Instantly kills everything caught in its irregular blast radius. Very long recharge.'
    },
    secondary: {
      name: 'Edema Toxin', type: 'projectile', cooldown: 0.4,
      speed: 400, damage: 15, life: 1.4, radius: 6, slow: 0.5, slowDuration: 2.2, hitTolerance: 16,
      splatRadius: 50, splatLife: 1, splatTickDamage: 10, splatTickInterval: 0.3,
      desc: 'A toxin shot with a forgiving hitbox that also swells the target with edema fluid, slowing it by half for 2.2s. On impact it also splats poison across a small area for 1s, damaging anything caught in the splash.'
    }
  },
  coronavirus: {
    id: 'coronavirus', name: 'Coronavirus', side: 'pathogen',
    color: '#ffd166', dark: '#8a6a16', shape: 'spiky',
    radius: 18, speed: 175, maxHp: 105,
    blurb: 'Agile virus that sends a homing clone to one-shot a target, or bursts spikes.',
    primary: {
      name: 'Viral Clone', type: 'summon_clone', cooldown: 9,
      duration: 14, maxClones: 1,
      desc: 'Spawns a temporary clone of itself, fighting all-out alongside you -- kills it gets are credited to you. Lasts 14s.'
    },
    secondary: {
      name: 'Spike Burst', type: 'aoe_projectile', cooldown: 0.6, shape: 'spike',
      speed: 420, damage: 24, life: 1.8, radius: 7, aoe: 58,
      desc: 'A long-range spike projectile that deals area damage on impact instead of single-target.'
    }
  },
  strepA: {
    id: 'strepA', name: 'Strep A', side: 'pathogen',
    color: '#ff8fe0', dark: '#8a2f72', shape: 'chain',
    radius: 17, speed: 180, maxHp: 100, hazardHpBonus: 45,
    blurb: 'Leaves a damaging SpeB trail behind it, like a tire road-spike strip. Gains a temporary HP cushion whenever a trail or mine is live, to encourage dropping them in the thick of a fight instead of somewhere safe.',
    primary: {
      name: 'SpeB Trail', type: 'trail_hazard', cooldown: 10,
      duration: 6, maxLength: 500, killCap: 5, maxActive: 2,
      hazardLife: 9, tickDamage: 7, tickInterval: 0.4, slow: 0.45,
      desc: 'Leaves a long trail of SpeB toxin as it moves. Enemies that cross it are slowed and take damage, and it blocks projectiles like a physical obstruction. While it is live, you gain a temporary HP bonus.'
    },
    secondary: {
      name: 'Streptolysin Shot', type: 'projectile', cooldown: 0.35,
      speed: 440, damage: 14, life: 1.3, radius: 6, hitTolerance: 16,
      desc: 'A toxin shot with a forgiving hitbox -- it doesn\'t need to land a precise direct hit, just pass close by an enemy.'
    }
  },
  ebola: {
    id: 'ebola', name: 'Ebola', side: 'pathogen',
    color: '#8a0f2e', dark: '#3a0515', shape: 'ebola',
    radius: 18, speed: 170, maxHp: 115, regen: 0.03,
    blurb: 'Pure support specialist -- no general-purpose weapon of its own, just a passive aura that shields or cloaks nearby pathogens, and a single-use ultimate that permanently poisons part of the map once the team is halfway to victory. Self-sustains with its own regen, so it never has to retreat to spawn to keep supporting others.',
    primary: {
      name: 'Environmental Toxin', type: 'permanent_poison', cooldown: 1, shape: 'cloud',
      range: 250, radius: 210, hazardLife: Infinity, killCap: Infinity, tickDamage: 11, tickInterval: 0.5,
      desc: 'A one-time ultimate -- locked out entirely until the team has racked up half the kills needed to win, and gone for good the instant it is used. Permanently poisons a large, irregularly-shaped area big enough to deny an entire entrance or chokepoint for the rest of the match.'
    },
    secondary: {
      name: 'Shielding', type: 'shield_aura', cooldown: 0.3, auto: true,
      radius: 75, shieldAmount: 45, duration: 5,
      desc: 'Passive -- any allied pathogen that stays close or touching gets a temporary 5s shield that soaks up damage before HP. Always active, no input needed. A shielded ally who kills or deals damage soon after credits Ebola with an assist and a cut of the damage.'
    }
  },
  phage: {
    id: 'phage', name: 'Bacteriophage', side: 'phage',
    color: '#7cffcb', dark: '#1f8f6b', shape: 'phage',
    radius: 15, speed: 185, maxHp: 150,
    shield: { max: 70, regenDelay: 3, regenRate: 25 },
    blurb: 'PvE hero. A close-range assassin that attaches to a host and injects lethal DNA. A rechargeable shield soaks up fire on the way in, then a tank-style charge lets it plow through and lyse several enemies in one burst.',
    primary: {
      name: 'Lyse', type: 'charge_lyse', cooldown: 9, shape: 'claw',
      duration: 0.45, chargeSpeed: 650, range: 14, chargeCount: 4,
      desc: 'A quick forward charge that instantly lyses (kills) any enemy it plows through. Activating it loads 4 charges -- fire off up to 4 dashes in a row before it goes on its long recharge.'
    },
    secondary: {
      name: 'Phage Burst', type: 'shotgun_projectile', cooldown: 0.18,
      count: 3, spread: 0.3, speed: 520, damage: 11, life: 1.0, radius: 4,
      desc: 'A tight burst of phage particles. Unlimited ammo.'
    }
  },
  virophage: {
    id: 'virophage', name: 'Virophage', side: 'phage',
    color: '#9ad1ff', dark: '#2c6a9e', shape: 'virophage',
    radius: 14, speed: 190, maxHp: 135,
    shield: { max: 55, regenDelay: 3, regenRate: 20 },
    blurb: 'PvE hero. A ranged hunter that launches a homing genome injector -- no contact needed, but still built tough for close scrapes. A rechargeable shield covers it when its Capsid Burst forces it into close range.',
    primary: {
      name: 'Genome Injection', type: 'clone_strike', cooldown: 10, shape: 'genome',
      speed: 260, life: 3.2, radius: 8, instaKill: true, aoe: 70,
      desc: 'Fires a homing viral genome that locks onto an enemy -- on impact it detonates in a large area, instantly killing everything caught inside, not just the target. Works at range, but recharges slowly.'
    },
    secondary: {
      name: 'Capsid Burst', type: 'parallel_projectile', cooldown: 0.2, shape: 'capsid',
      count: 3, spacing: 16, speed: 480, damage: 7, life: 1.0, radius: 4,
      desc: 'Three parallel, linear streams of viral capsid fragments fired straight ahead -- precise parallel lanes, not a spread. Unlimited ammo.'
    }
  },
  // Zeus roles: not a body on the battlefield at all -- a free commander
  // view over the whole map with four point-and-click powers. Their
  // primary/secondary here exist only so the character-select screen has
  // something to show; actual Zeus gameplay never reads unit.abilities.
  dendritic: {
    id: 'dendritic', name: 'Dendritic Cell', side: 'immune',
    color: '#c7ff4f', dark: '#5c7a1b', shape: 'blob', radius: 18, speed: 0, maxHp: 1,
    blurb: 'Not a fighter -- a commander. No body on the battlefield, just a full map view that sees everyone, cloaked units included, with four powers over your own team: decloak an enemy, cloak an ally, order an ally to attack a specific target, and drag floater blocks into chokepoints.',
    primary: {
      name: 'Decloak / Order Attack', type: 'zeus', cooldown: 0,
      desc: 'Decloak: click an enemy currently hidden by Invisibility or Cloak to strip it, exposing them to view and targeting for your whole team. Order Attack: click-drag from an ally to a specific enemy to force that ally to beeline for and engage that target for a while.'
    },
    secondary: {
      name: 'Cloak Ally / Move Floater', type: 'zeus', cooldown: 0,
      desc: 'Cloak Ally: click a teammate to hide them from enemy view the same way Ebola\'s Viral Cloak does -- no damage immunity, just visual stealth. Move Floater: click-drag a drifting obstacle block to a new spot, where it stays put instead of drifting off again.'
    }
  },
  rabies: {
    id: 'rabies', name: 'Rabies', side: 'pathogen',
    color: '#ff4f8f', dark: '#7a1b45', shape: 'chain', radius: 18, speed: 0, maxHp: 1,
    blurb: 'Not a fighter -- a commander. No body on the battlefield, just a full map view that sees everyone, cloaked units included, with four powers over your own team: decloak an enemy, cloak an ally, order an ally to attack a specific target, and drag floater blocks into chokepoints.',
    primary: {
      name: 'Decloak / Order Attack', type: 'zeus', cooldown: 0,
      desc: 'Decloak: click an enemy currently hidden by Invisibility or Cloak to strip it, exposing them to view and targeting for your whole team. Order Attack: click-drag from an ally to a specific enemy to force that ally to beeline for and engage that target for a while.'
    },
    secondary: {
      name: 'Cloak Ally / Move Floater', type: 'zeus', cooldown: 0,
      desc: 'Cloak Ally: click a teammate to hide them from enemy view the same way Ebola\'s Viral Cloak does -- no damage immunity, just visual stealth. Move Floater: click-drag a drifting obstacle block to a new spot, where it stays put instead of drifting off again.'
    }
  }
};

const IMMUNE_IDS = ['macrophage', 'neutrophil', 'bcell', 'tcell'];
const PATHOGEN_IDS = ['bacterium', 'coronavirus', 'strepA', 'ebola'];
const PHAGE_IDS = ['phage', 'virophage'];
// The original 3-a-side roster, from before T-Cell/Ebola existed -- kept
// around for PvBot's "10 v 10 Classic" mode.
const IMMUNE_IDS_CLASSIC = ['macrophage', 'neutrophil', 'bcell'];
const PATHOGEN_IDS_CLASSIC = ['bacterium', 'coronavirus', 'strepA'];
// Zeus commander picks -- never added to the bot-fill pools above, only
// offered as extra character-select cards in PvBot 16v16.
const ZEUS_IDS = { dendritic: 'immune', rabies: 'pathogen' };

// Neutrophil and Plasma/B-Cell each have two options per slot -- picked at
// the character-select screen rather than fixed.
CHARACTERS.neutrophil.primaryOptions = [
  CHARACTERS.neutrophil.primary,
  {
    name: 'Respiratory Burst', type: 'poison_cloud', cooldown: 8, shape: 'cloud',
    radius: 95, hazardLife: 6, tickDamage: 13, tickInterval: 0.5,
    desc: 'Exhales a lingering toxic cloud. Any enemy that wanders into it takes steady damage for as long as they stay inside.'
  }
];
CHARACTERS.neutrophil.secondaryOptions = [
  CHARACTERS.neutrophil.secondary,
  {
    name: 'Degranulation', type: 'parallel_projectile', cooldown: 0.18, shape: 'rocket',
    count: 3, spacing: 18, speed: 500, damage: 20, life: 1.0, radius: 5,
    desc: 'Three unguided toxin rockets fired in parallel lines -- higher damage than Toxin Spray, and three times the lanes.'
  }
];

CHARACTERS.bcell.primaryOptions = [
  CHARACTERS.bcell.primary,
  {
    name: 'IgG1 Artillery', type: 'artillery_volley', cooldown: 9, shape: 'antibody',
    volleyCount: 20, volleyInterval: 0.12, spread: 0.1,
    speed: 360, damage: 16, life: 8, radius: 6, aoe: 42,
    desc: 'BM-21 Grad-style rocket artillery -- unleashes an extended wave of 20 explosive antibody rockets down-range over a couple of seconds. Each rocket flies until it hits a wall or an enemy, not a fixed range. Recharges faster than Antibody Barrage, making it the more sustainable offensive option.'
  }
];
CHARACTERS.bcell.secondaryOptions = [
  CHARACTERS.bcell.secondary,
  {
    name: 'IgG3 Guided Missile', type: 'guided_missile', cooldown: 9, shape: 'igg3missile',
    speed: 760, life: 5, radius: 9, piercing: true, aoe: 55, hitTolerance: 20,
    desc: 'A one-shot-kill guided antibody missile with an area-damage warhead and a forgiving proximity fuse -- it detonates once it gets close to a target, no precise direct hit needed. Takes you out of your body (invulnerable) to steer it by hand into a target -- it punches straight through walls and cover to get there. Recharges quickly.'
  }
];

CHARACTERS.coronavirus.primaryOptions = [
  CHARACTERS.coronavirus.primary,
  {
    name: 'Invisibility', type: 'invisibility', cooldown: 16,
    duration: 9,
    desc: 'Turns invisible for 9s -- hidden from enemy targeting and view beyond close range, and takes 40% less damage from normal hits while it lasts. Not full immunity, though -- an instant-kill effect that catches you still kills you.'
  }
];

CHARACTERS.strepA.primaryOptions = [
  CHARACTERS.strepA.primary,
  {
    name: 'Toxin Mines', type: 'mine_trap', cooldown: 3, shape: 'mine',
    maxActive: 5, burstCount: 5, triggerRadius: 26, blastRadius: 65, damage: 42, mineLife: 28,
    desc: 'Scatters all 5 invisible toxin mines at once in a ring around you, each slowly drifting off in its own direction -- hidden from the enemy until they get close enough to trigger one, each on its own timer. While any are out, you gain a temporary HP bonus.'
  }
];

CHARACTERS.bacterium.primaryOptions = [
  CHARACTERS.bacterium.primary,
  {
    name: 'Dormant Endospore', type: 'endospore_escape', cooldown: 50, shape: 'spore',
    duration: 2.6, speed: 900,
    desc: 'Passive -- automatically triggers in the instant before a killing blow would land, instead of dying. You go dormant and invulnerable inside a spore and pilot it anywhere on the map at high speed with a temporary radar, then reform wherever it lands. Long recharge, so it will not save you twice in a row.'
  }
];

CHARACTERS.tcell.secondaryOptions = [
  CHARACTERS.tcell.secondary,
  {
    name: 'Rapid Recharge', type: 'recharge_aura', cooldown: 0.33, auto: true,
    radius: 75, rechargeAmount: 0.6, supportWindow: 5, bonusChargeWindow: 12,
    desc: 'Passive -- speeds up nearby allies\' ability cooldowns. An ally whose RMB is already fully charged instead banks one free extra use of it, with no cooldown, for a little while -- e.g. a Macrophage could Engulf Surge, let it lapse, then Engulf Surge again right away. An ally you recharge who lands a kill credits you with an assist, and 60% of any damage they deal while recharged counts toward your own damage total too.'
  }
];

CHARACTERS.ebola.secondaryOptions = [
  CHARACTERS.ebola.secondary,
  {
    name: 'Viral Cloak', type: 'cloak_aura', cooldown: 0.3, auto: true,
    radius: 75, duration: 6,
    desc: 'Passive -- hides nearby allied pathogens from enemy view. Visual stealth only -- a cloaked ally stays fully targetable and can still be hit and killed as normal.'
  }
];

function getCharacter(id) { return CHARACTERS[id]; }
