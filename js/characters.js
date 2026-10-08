const CHARACTERS = {
  macrophage: {
    id: 'macrophage', name: 'Macrophage', side: 'immune',
    color: '#4fd1ff', dark: '#1b6e86', shape: 'blob',
    radius: 22, speed: 150, maxHp: 220, regen: 0.02,
    blurb: 'A tanky devourer that swells up and swallows pathogens whole, agar.io-style. Contact-based and mostly automatic: it bites anything it touches, and your only real decision is when to trigger Engulf Surge.',
    primary: {
      name: 'Engulf Surge', type: 'self_buff_devour', cooldown: 12,
      duration: 5, sizeMult: 3, speedMult: 1.7,
      desc: 'Grows to 3x size and accelerates for 5s. Touching an enemy while active devours it instantly. The one deliberate decision you make -- everything else is automatic.'
    },
    secondary: {
      name: 'Phagocytose', type: 'melee_bite', cooldown: 0.35, auto: true,
      range: 8, damage: 16,
      desc: 'Automatically bites any enemy it is physically attached to -- no button press needed, it just happens on contact. Can chew through several enemies in sequence.'
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
      name: 'Antibody Barrage', type: 'radial_projectile', cooldown: 4.5, shape: 'antibody',
      count: 12, speed: 420, damage: 15, life: 1.3, radius: 5,
      desc: 'Aggressive antibody shooting -- fires antibodies in a full 360 around the B-Cell at once.'
    },
    secondary: {
      name: 'IgG Shotgun', type: 'shotgun_projectile', cooldown: 0.3, shape: 'antibody',
      count: 5, spread: 0.5, speed: 480, damage: 9, life: 0.9, radius: 5,
      desc: 'A forward spread of antibodies. Unlimited ammo, but a slower rate of fire than the Neutrophil secondaries.'
    }
  },
  bacterium: {
    id: 'bacterium', name: 'Anthrax / E.coli', side: 'pathogen',
    color: '#ff6b6b', dark: '#8c2626', shape: 'rod',
    radius: 20, speed: 140, maxHp: 170, regen: 0.02,
    blurb: 'Slow bacterium with an overwhelming lethal toxin and a reliable poke. Tanky and slowly self-repairing, the pathogen answer to the Macrophage.',
    primary: {
      name: 'Lethal Toxin', type: 'nuke_projectile', cooldown: 15,
      speed: 320, life: 2.2, radius: 10, aoe: 75, instaKill: true,
      desc: 'One devastating shot that detonates on anything -- walls, obstacles, or a target. Instantly kills everything caught in its irregular blast radius. Very long recharge.'
    },
    secondary: {
      name: 'Edema Toxin', type: 'projectile', cooldown: 0.4,
      speed: 400, damage: 15, life: 1.4, radius: 6,
      desc: 'A standard toxin projectile, just like a normal shot.'
    }
  },
  coronavirus: {
    id: 'coronavirus', name: 'Coronavirus', side: 'pathogen',
    color: '#ffd166', dark: '#8a6a16', shape: 'spiky',
    radius: 18, speed: 175, maxHp: 105,
    blurb: 'Agile virus that sends a homing clone to one-shot a target, or bursts spikes.',
    primary: {
      name: 'Viral Clone', type: 'summon_clone', cooldown: 9,
      duration: 14, maxClones: 2,
      desc: 'Spawns a temporary clone of itself that fights all-out alongside you. Up to 2 active at once -- kills they get are credited to you. Lasts 14s.'
    },
    secondary: {
      name: 'Spike Burst', type: 'aoe_projectile', cooldown: 0.6,
      speed: 420, damage: 20, life: 1.2, radius: 7, aoe: 50,
      desc: 'A spike projectile that deals area damage on impact instead of single-target.'
    }
  },
  strepA: {
    id: 'strepA', name: 'Strep A', side: 'pathogen',
    color: '#ff8fe0', dark: '#8a2f72', shape: 'chain',
    radius: 17, speed: 180, maxHp: 100,
    blurb: 'Leaves a damaging SpeB trail behind it, like a tire road-spike strip.',
    primary: {
      name: 'SpeB Trail', type: 'trail_hazard', cooldown: 10,
      duration: 3, maxLength: 320, killCap: 5, maxActive: 2,
      hazardLife: 9, tickDamage: 7, tickInterval: 0.4, slow: 0.45,
      desc: 'Leaves a trail of SpeB toxin as it moves. Enemies that cross it are slowed and take damage.'
    },
    secondary: {
      name: 'Streptolysin Shot', type: 'projectile', cooldown: 0.35,
      speed: 440, damage: 14, life: 1.3, radius: 6,
      desc: 'A standard projectile toxin shot.'
    }
  },
  phage: {
    id: 'phage', name: 'Bacteriophage', side: 'phage',
    color: '#7cffcb', dark: '#1f8f6b', shape: 'phage',
    radius: 15, speed: 185, maxHp: 150,
    blurb: 'PvE hero. A close-range assassin that attaches to a host and injects lethal DNA. Contact-based kit, so it runs high HP.',
    primary: {
      name: 'Lyse', type: 'melee_instakill', cooldown: 4.5,
      range: 8,
      desc: 'Injects DNA into an enemy it is physically attached to, destroying it instantly. Must make contact to land.'
    },
    secondary: {
      name: 'Phage Burst', type: 'shotgun_projectile', cooldown: 0.18,
      count: 3, spread: 0.3, speed: 520, damage: 8, life: 1.0, radius: 4,
      desc: 'A tight burst of phage particles. Unlimited ammo.'
    }
  },
  virophage: {
    id: 'virophage', name: 'Virophage', side: 'phage',
    color: '#9ad1ff', dark: '#2c6a9e', shape: 'virophage',
    radius: 14, speed: 190, maxHp: 135,
    blurb: 'PvE hero. A ranged hunter that launches a homing genome injector -- no contact needed, but still built tough for close scrapes.',
    primary: {
      name: 'Genome Injection', type: 'clone_strike', cooldown: 7.5,
      speed: 260, life: 3.2, radius: 8, instaKill: true,
      desc: 'Fires a homing viral genome that locks onto an enemy and kills it instantly on contact. Works at range, but recharges slowly.'
    },
    secondary: {
      name: 'Capsid Burst', type: 'shotgun_projectile', cooldown: 0.2,
      count: 3, spread: 0.35, speed: 480, damage: 7, life: 1.0, radius: 4,
      desc: 'A scattershot of viral capsid fragments. Unlimited ammo.'
    }
  }
};

const IMMUNE_IDS = ['macrophage', 'neutrophil', 'bcell'];
const PATHOGEN_IDS = ['bacterium', 'coronavirus', 'strepA'];
const PHAGE_IDS = ['phage', 'virophage'];

// Neutrophil and Plasma/B-Cell each have two options per slot -- picked at
// the character-select screen rather than fixed.
CHARACTERS.neutrophil.primaryOptions = [
  CHARACTERS.neutrophil.primary,
  {
    name: 'Respiratory Burst', type: 'pulse_aoe', cooldown: 6.5,
    radius: 75, damage: 32,
    desc: 'An instant burst of reactive oxygen species around the Neutrophil, damaging every enemy nearby. No travel time.'
  }
];
CHARACTERS.neutrophil.secondaryOptions = [
  CHARACTERS.neutrophil.secondary,
  {
    name: 'Degranulation', type: 'projectile', cooldown: 0.18, shape: 'rocket',
    speed: 500, damage: 14, life: 1.0, radius: 5,
    desc: 'An unguided toxin rocket -- more damage than Toxin Spray, slightly slower to recharge.'
  }
];

CHARACTERS.bcell.primaryOptions = [
  CHARACTERS.bcell.primary,
  {
    name: 'IgG1 Artillery', type: 'aoe_projectile', cooldown: 4, shape: 'antibody',
    speed: 340, damage: 24, life: 1.6, radius: 7, aoe: 55,
    desc: 'A single heavy artillery shot fired in one direction -- slow and unmissable, exploding into a damaging antibody cloud on impact.'
  }
];
CHARACTERS.bcell.secondaryOptions = [
  CHARACTERS.bcell.secondary,
  {
    name: 'IgG3 Guided Missile', type: 'guided_missile', cooldown: 18, shape: 'missile',
    speed: 480, life: 5, radius: 9,
    desc: 'A one-shot-kill guided antibody missile. Takes you out of your body (invulnerable, blind to everything but a threat radar) to steer it by hand into a target.'
  }
];

CHARACTERS.coronavirus.primaryOptions = [
  CHARACTERS.coronavirus.primary,
  {
    name: 'Invisibility', type: 'invisibility', cooldown: 16,
    duration: 5,
    desc: 'Turns invisible for 5s -- hidden from enemy targeting and enemy view beyond close range. A pure stealth and escape tool.'
  }
];

function getCharacter(id) { return CHARACTERS[id]; }
