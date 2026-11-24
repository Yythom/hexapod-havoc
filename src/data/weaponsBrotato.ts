import type { WeaponDef } from './weapons';

/** 95 把与 Brotato 武器数值/行为对齐的武器（名称/图标为本作原创）。由工具生成后手工维护。 */
export const BROTATO_WEAPONS: WeaponDef[] = [
 {
  "id": "anchor",
  "name": "锚壳重锤",
  "kind": "melee",
  "classes": [
   "Naval",
   "Heavy"
  ],
  "damage": 24.75,
  "cooldown": 2.074,
  "range": 175.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 10.0,
  "tiers": [
   {
    "damage": 24.75,
    "cooldown": 2.074,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 45.0,
    "cooldown": 1.92,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 74,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 70.0,
    "cooldown": 1.86,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 202,
    "scaling": {
     "melee": 1.25
    }
   },
   {
    "damage": 110.0,
    "cooldown": 1.81,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 225.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 580,
    "scaling": {
     "melee": 1.5
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-anchor",
  "iconShape": "anchor",
  "iconColor": "#8b93a6",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "brick",
  "name": "碎岩砖",
  "kind": "melee",
  "classes": [
   "Blunt"
  ],
  "damage": 30.0,
  "cooldown": 1.39,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 30.0,
    "cooldown": 1.39,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 60.0,
    "cooldown": 1.39,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 90,
    "scaling": {
     "melee": 0.65
    }
   },
   {
    "damage": 90.0,
    "cooldown": 1.39,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 246,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 120.0,
    "cooldown": 1.39,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 624,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-brick",
  "iconShape": "brick",
  "iconColor": "#8a5a3c",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "breakChance": 0.01
  }
 },
 {
  "id": "cacti-club",
  "name": "仙人掌刺棒",
  "kind": "melee",
  "classes": [
   "Primitive",
   "Heavy"
  ],
  "damage": 15.0,
  "cooldown": 1.66,
  "range": 200.0,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 8.0,
  "tiers": [
   {
    "damage": 15.0,
    "cooldown": 1.66,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.58,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "melee": 0.85
    }
   },
   {
    "damage": 35.0,
    "cooldown": 1.51,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 124,
    "scaling": {
     "melee": 0.9
    }
   },
   {
    "damage": 60.0,
    "cooldown": 1.36,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 360,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-cacti-club",
  "iconShape": "club",
  "iconColor": "#7fae3a",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "onHit": {
   "burst": {
    "count": 4,
    "damage": 0.6,
    "texture": "needle",
    "radius": 4,
    "speed": 820
   }
  }
 },
 {
  "id": "captains-sword",
  "name": "船长弯刀",
  "kind": "melee",
  "classes": [
   "Naval",
   "Blade"
  ],
  "damage": 15.13,
  "cooldown": 1.195,
  "range": 200.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 15.13,
    "cooldown": 1.195,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 27.5,
    "cooldown": 1.112,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 54,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 1.03,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "melee": 1.25
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-captains-sword",
  "iconShape": "blade",
  "iconColor": "#d8b45a",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "freeSlotDamage": 25
  }
 },
 {
  "id": "chainsaw",
  "name": "锯齿颚",
  "kind": "melee",
  "classes": [
   "Blade",
   "Tool"
  ],
  "damage": 3.03,
  "cooldown": 0.615,
  "range": 175.0,
  "scaling": {
   "melee": 0.75
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 3.03,
    "cooldown": 0.615,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.15,
    "price": 14,
    "scaling": {
     "melee": 0.75
    }
   },
   {
    "damage": 5.5,
    "cooldown": 0.572,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.15,
    "price": 30,
    "scaling": {
     "melee": 0.75
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.53,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.15,
    "price": 70,
    "scaling": {
     "melee": 0.75
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.56,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 5,
    "lifesteal": 0.3,
    "price": 184,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-chainsaw",
  "iconShape": "saw",
  "iconColor": "#c8d0dc",
  "melee": {
   "hitRadius": 20,
   "style": "flurry"
  }
 },
 {
  "id": "chopper",
  "name": "剁叶刀",
  "kind": "melee",
  "classes": [
   "Blade"
  ],
  "damage": 6.0,
  "cooldown": 0.99,
  "range": 135.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 6.0,
    "cooldown": 0.99,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 135.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 12.0,
    "cooldown": 0.99,
    "critChance": 0.15,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 18.0,
    "cooldown": 0.96,
    "critChance": 0.2,
    "critMultiplier": 2.0,
    "range": 165.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 88,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.89,
    "critChance": 0.25,
    "critMultiplier": 2.0,
    "range": 180.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-chopper",
  "iconShape": "cleaver",
  "iconColor": "#b8c0cc",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "healOnKill": 1
  }
 },
 {
  "id": "circular-saw",
  "name": "圆锯甲",
  "kind": "melee",
  "classes": [
   "Blade",
   "Medical"
  ],
  "damage": 5.5,
  "cooldown": 0.778,
  "range": 175.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 5.5,
    "cooldown": 0.778,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.45,
    "price": 16,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.72,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.45,
    "price": 36,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.67,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.5,
    "price": 80,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.62,
    "critChance": 0.2,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0.6,
    "price": 206,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-circular-saw",
  "iconShape": "saw",
  "iconColor": "#c8d8e8",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "claw",
  "name": "大颚",
  "kind": "melee",
  "classes": [
   "Unarmed",
   "Precise"
  ],
  "damage": 5.0,
  "cooldown": 0.78,
  "range": 150.0,
  "scaling": {
   "melee": 0.15
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 5.0,
    "cooldown": 0.78,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "melee": 0.15
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.74,
    "critChance": 0.15,
    "critMultiplier": 2.15,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 36,
    "scaling": {
     "melee": 0.2
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.69,
    "critChance": 0.2,
    "critMultiplier": 2.3,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 80,
    "scaling": {
     "melee": 0.25
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.61,
    "critChance": 0.25,
    "critMultiplier": 2.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "melee": 0.3
    }
   }
  ],
  "icon": "w-mandible",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  }
 },
 {
  "id": "dex-troyer",
  "name": "爆雷钳",
  "kind": "melee",
  "classes": [
   "Legendary",
   "Explosive"
  ],
  "damage": 16.64,
  "cooldown": 1.649,
  "range": 400.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 10.0,
  "tiers": [
   {
    "damage": 16.64,
    "cooldown": 1.649,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 30.25,
    "cooldown": 1.543,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 58,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 55.0,
    "cooldown": 1.436,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 170,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 100.0,
    "cooldown": 1.33,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 536,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 3,
  "icon": "w-g-dex-troyer",
  "iconShape": "claw",
  "iconColor": "#e8c04a",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "special": {
   "explodeChance": 0.5,
   "explodeRadius": 60
  }
 },
 {
  "id": "drill",
  "name": "钻角",
  "kind": "melee",
  "classes": [
   "Legendary",
   "Precise"
  ],
  "damage": 1.66,
  "cooldown": 0.558,
  "range": 100.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 1.66,
    "cooldown": 0.558,
    "critChance": 0.5,
    "critMultiplier": 2.5,
    "range": 100.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 3.03,
    "cooldown": 0.522,
    "critChance": 0.5,
    "critMultiplier": 2.5,
    "range": 100.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 5.5,
    "cooldown": 0.486,
    "critChance": 0.5,
    "critMultiplier": 2.5,
    "range": 100.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.45,
    "critChance": 0.5,
    "critMultiplier": 2.5,
    "range": 100.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 140,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 3,
  "icon": "w-g-drill",
  "iconShape": "drill",
  "iconColor": "#b0b8c8",
  "melee": {
   "hitRadius": 20,
   "style": "flurry"
  },
  "special": {
   "materialOnCritKill": 1.0
  }
 },
 {
  "id": "excalibur",
  "name": "王虫之剑",
  "kind": "melee",
  "classes": [
   "Legendary",
   "Blade"
  ],
  "damage": 33.28,
  "cooldown": 0.818,
  "range": 200.0,
  "scaling": {
   "melee": 2.0
  },
  "critMultiplier": 2.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 33.28,
    "cooldown": 0.818,
    "critChance": 0.1,
    "critMultiplier": 2.5,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "melee": 2.0
    }
   },
   {
    "damage": 60.5,
    "cooldown": 0.766,
    "critChance": 0.1,
    "critMultiplier": 2.5,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 90,
    "scaling": {
     "melee": 2.0
    }
   },
   {
    "damage": 110.0,
    "cooldown": 0.713,
    "critChance": 0.1,
    "critMultiplier": 2.5,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 290,
    "scaling": {
     "melee": 2.0
    }
   },
   {
    "damage": 200.0,
    "cooldown": 0.66,
    "critChance": 0.1,
    "critMultiplier": 2.5,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 976,
    "scaling": {
     "melee": 2.0
    }
   }
  ],
  "minTier": 3,
  "icon": "w-g-excalibur",
  "iconShape": "blade",
  "iconColor": "#f0d47a",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "armorPerWeapon": -2
  }
 },
 {
  "id": "fist",
  "name": "虫拳",
  "kind": "melee",
  "classes": [
   "Unarmed"
  ],
  "damage": 8.0,
  "cooldown": 0.78,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 8.0,
    "cooldown": 0.78,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 16.0,
    "cooldown": 0.73,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 42,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 32.0,
    "cooldown": 0.69,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 118,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 64.0,
    "cooldown": 0.59,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 378,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-fist",
  "iconShape": "fist",
  "iconColor": "#c88a58",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  }
 },
 {
  "id": "flaming-knuckles",
  "name": "燃焰指虎",
  "kind": "melee",
  "classes": [
   "Unarmed",
   "Elemental"
  ],
  "damage": 11.0,
  "cooldown": 0.788,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 11.0,
    "cooldown": 0.788,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.73,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 0.69,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 0.59,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-flaming-knuckles",
  "iconShape": "fist",
  "iconColor": "#f07830",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "ghost-axe",
  "name": "幽甲斧",
  "kind": "melee",
  "classes": [
   "Ethereal"
  ],
  "damage": 12.0,
  "cooldown": 1.73,
  "range": 200.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 12.0,
    "cooldown": 1.73,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 18.0,
    "cooldown": 1.66,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 44,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 24.0,
    "cooldown": 1.58,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 1.51,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 272,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-ghost-axe",
  "iconShape": "axe",
  "iconColor": "#9ce8d8",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "growth": {
   "kills": 25
  }
 },
 {
  "id": "ghost-flint",
  "name": "幽火燧",
  "kind": "melee",
  "classes": [
   "Ethereal"
  ],
  "damage": 6.0,
  "cooldown": 1.23,
  "range": 170.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 6.0,
    "cooldown": 1.23,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 170.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 9.0,
    "cooldown": 1.17,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 180.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.1,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 190.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 74,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.04,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-ghost-flint",
  "iconShape": "flint",
  "iconColor": "#9ce8d8",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "special": {
   "growthAttackSpeed": 0.01
  }
 },
 {
  "id": "hammer",
  "name": "甲壳重锤",
  "kind": "melee",
  "classes": [
   "Blunt",
   "Heavy"
  ],
  "damage": 22.0,
  "cooldown": 1.804,
  "range": 175.0,
  "scaling": {
   "melee": 1.5
  },
  "critMultiplier": 1.75,
  "knockback": 30.0,
  "tiers": [
   {
    "damage": 22.0,
    "cooldown": 1.804,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 24,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 40.0,
    "cooldown": 1.67,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 75.0,
    "cooldown": 1.59,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 40.0,
    "lifesteal": 0,
    "price": 212,
    "scaling": {
     "melee": 1.75
    }
   },
   {
    "damage": 120.0,
    "cooldown": 1.5,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 50.0,
    "lifesteal": 0,
    "price": 624,
    "scaling": {
     "melee": 2.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-hammer",
  "iconShape": "hammer",
  "iconColor": "#9a7a58",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  }
 },
 {
  "id": "hand",
  "name": "采蜜手",
  "kind": "melee",
  "classes": [
   "Unarmed",
   "Support"
  ],
  "damage": 1.0,
  "cooldown": 1.01,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 30.0,
  "tiers": [
   {
    "damage": 1.0,
    "cooldown": 1.01,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.93,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.86,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 50,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.71,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-hand",
  "iconShape": "fist",
  "iconColor": "#e8b060",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  },
  "bonusStats": {
   "harvest": 10
  }
 },
 {
  "id": "hatchet",
  "name": "小树斧",
  "kind": "melee",
  "classes": [
   "Primitive"
  ],
  "damage": 7.0,
  "cooldown": 0.68,
  "range": 125.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 7.0,
    "cooldown": 0.68,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 11.0,
    "cooldown": 0.67,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 36,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 22.0,
    "cooldown": 0.65,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 96,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 45.0,
    "cooldown": 0.63,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 294,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-hatchet",
  "iconShape": "axe",
  "iconColor": "#b07a48",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  }
 },
 {
  "id": "hiking-pole",
  "name": "远足杖",
  "kind": "melee",
  "classes": [
   "Support"
  ],
  "damage": 12.0,
  "cooldown": 1.42,
  "range": 175.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 12.0,
    "cooldown": 1.42,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 18.0,
    "cooldown": 1.34,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 44,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 24.0,
    "cooldown": 1.25,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.17,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-hiking-pole",
  "iconShape": "staff",
  "iconColor": "#a89060",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "special": {
   "rangePerStep": 1
  },
  "bonusStats": {
   "range": 10
  }
 },
 {
  "id": "jousting-lance",
  "name": "骑甲长枪",
  "kind": "melee",
  "classes": [
   "Medieval"
  ],
  "damage": 20.0,
  "cooldown": 1.58,
  "range": 250.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 20.0,
    "cooldown": 1.58,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 24,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 25.0,
    "cooldown": 1.5,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 52,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.42,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 114,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 50.0,
    "cooldown": 1.33,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 316,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-jousting-lance",
  "iconShape": "spear",
  "iconColor": "#c8a060",
  "melee": {
   "hitRadius": 20,
   "style": "charge"
  },
  "special": {
   "stationaryPenalty": {
    "damagePct": -0.25,
    "speedPct": 0.05
   }
  },
  "bonusStats": {
   "speedPct": 0.05
  }
 },
 {
  "id": "knife",
  "name": "刺足",
  "kind": "melee",
  "classes": [
   "Precise"
  ],
  "damage": 9.0,
  "cooldown": 1.01,
  "range": 150.0,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.5,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 9.0,
    "cooldown": 1.01,
    "critChance": 0.2,
    "critMultiplier": 2.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 13.0,
    "cooldown": 0.93,
    "critChance": 0.3,
    "critMultiplier": 3.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 18.0,
    "cooldown": 0.86,
    "critChance": 0.4,
    "critMultiplier": 3.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 88,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.78,
    "critChance": 0.5,
    "critMultiplier": 4.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-legspike",
  "melee": {
   "hitRadius": 20,
   "style": "flurry"
  }
 },
 {
  "id": "lightning-shiv",
  "name": "雷针",
  "kind": "melee",
  "classes": [
   "Precise",
   "Elemental"
  ],
  "damage": 3.0,
  "cooldown": 1.01,
  "range": 150.0,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 3.0,
    "cooldown": 1.01,
    "critChance": 0.04,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 6.0,
    "cooldown": 0.93,
    "critChance": 0.06,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 9.0,
    "cooldown": 0.86,
    "critChance": 0.08,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.78,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 162,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-thunder",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  }
 },
 {
  "id": "lute",
  "name": "虫鸣琴",
  "kind": "melee",
  "classes": [
   "Musical",
   "Support"
  ],
  "damage": 4.0,
  "cooldown": 1.31,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 4.0,
    "cooldown": 1.31,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 8.0,
    "cooldown": 1.25,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.2,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 74,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 16.0,
    "cooldown": 1.14,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 225.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 166,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-lute",
  "iconShape": "lute",
  "iconColor": "#d8a050",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "onHit": {
   "vulnerable": true
  }
 },
 {
  "id": "mace",
  "name": "钝星锤",
  "kind": "melee",
  "classes": [
   "Heavy",
   "Medieval"
  ],
  "damage": 22.0,
  "cooldown": 1.501,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 22.0,
    "cooldown": 1.501,
    "critChance": 0.04,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 24,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 1.39,
    "critChance": 0.04,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 60.0,
    "cooldown": 1.31,
    "critChance": 0.08,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 180,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 100.0,
    "cooldown": 1.23,
    "critChance": 0.12,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 536,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-mace",
  "iconShape": "mace",
  "iconColor": "#9a8a78",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  }
 },
 {
  "id": "plank",
  "name": "爆裂木刃",
  "kind": "melee",
  "classes": [
   "Explosive",
   "Elemental"
  ],
  "damage": 10.0,
  "cooldown": 1.23,
  "range": 150.0,
  "scaling": {
   "melee": 0.6
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.23,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.6
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.14,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.7
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.06,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.98,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 0.9
    }
   }
  ],
  "icon": "w-g-plank",
  "iconShape": "plank",
  "iconColor": "#b07a48",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "explodeChance": 0.4,
   "explodeRadius": 55
  }
 },
 {
  "id": "plasma-sledge",
  "name": "等离子锤",
  "kind": "melee",
  "classes": [
   "Elemental",
   "Explosive"
  ],
  "damage": 24.2,
  "cooldown": 1.798,
  "range": 175.0,
  "scaling": {
   "melee": 1.5
  },
  "critMultiplier": 1.75,
  "knockback": 30.0,
  "tiers": [
   {
    "damage": 24.2,
    "cooldown": 1.798,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 44.0,
    "cooldown": 1.674,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 72,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 80.0,
    "cooldown": 1.55,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 224,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 120.0,
    "cooldown": 1.49,
    "critChance": 0.03,
    "critMultiplier": 1.75,
    "range": 175.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 624,
    "scaling": {
     "melee": 2.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-plasma-sledge",
  "iconShape": "hammer",
  "iconColor": "#8ce8ff",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "explodeChance": 0.4,
   "explodeRadius": 60
  }
 },
 {
  "id": "power-fist",
  "name": "爆拳",
  "kind": "melee",
  "classes": [
   "Unarmed",
   "Explosive"
  ],
  "damage": 12.1,
  "cooldown": 0.8,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 12.1,
    "cooldown": 0.8,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 22.0,
    "cooldown": 0.745,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 48,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 0.69,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 0.59,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-power-fist",
  "iconShape": "fist",
  "iconColor": "#ffb040",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "explodeChance": 0.4,
   "explodeRadius": 60
  }
 },
 {
  "id": "pruner",
  "name": "修枝剪",
  "kind": "melee",
  "classes": [
   "Support"
  ],
  "damage": 10.0,
  "cooldown": 1.14,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.25,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.14,
    "critChance": 0.03,
    "critMultiplier": 1.25,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.06,
    "critChance": 0.06,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.65
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.98,
    "critChance": 0.09,
    "critMultiplier": 1.75,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.89,
    "critChance": 0.12,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-scarab",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "onHit": {
   "heal": 0.15
  }
 },
 {
  "id": "quarterstaff",
  "name": "四节棍",
  "kind": "melee",
  "classes": [
   "Primitive",
   "Medieval"
  ],
  "damage": 10.0,
  "cooldown": 1.42,
  "range": 175.0,
  "scaling": {
   "melee": 0.75
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.42,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.75
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.25,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.85
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.09,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.92,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 1.25
    }
   }
  ],
  "icon": "w-g-quarterstaff",
  "iconShape": "staff",
  "iconColor": "#b08a50",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "rock",
  "name": "滚石甲",
  "kind": "melee",
  "classes": [
   "Primitive",
   "Blunt"
  ],
  "damage": 20.0,
  "cooldown": 1.68,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 20.0,
    "cooldown": 1.68,
    "critChance": 0.1,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 24,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 35.0,
    "cooldown": 1.61,
    "critChance": 0.15,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 62,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 1.53,
    "critChance": 0.2,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 70.0,
    "cooldown": 1.46,
    "critChance": 0.25,
    "critMultiplier": 1.5,
    "range": 150.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 404,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-dungball",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "bonusStats": {
   "armor": 1
  }
 },
 {
  "id": "scissors",
  "name": "双刃剪",
  "kind": "melee",
  "classes": [
   "Medical",
   "Precise"
  ],
  "damage": 5.0,
  "cooldown": 1.01,
  "range": 150.0,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 5.0,
    "cooldown": 1.01,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0.4,
    "price": 14,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.98,
    "critChance": 0.12,
    "critMultiplier": 2.15,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0.45,
    "price": 36,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.94,
    "critChance": 0.15,
    "critMultiplier": 2.3,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0.5,
    "price": 80,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.86,
    "critChance": 0.2,
    "critMultiplier": 2.5,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0.6,
    "price": 184,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-scissors",
  "iconShape": "shears",
  "iconColor": "#c8d0dc",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  }
 },
 {
  "id": "screwdriver",
  "name": "种子地雷",
  "kind": "device",
  "classes": [
   "Tool"
  ],
  "damage": 8.0,
  "cooldown": 1.06,
  "range": 135.0,
  "scaling": {
   "engineering": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 3.0,
  "tiers": [
   {
    "damage": 8.0,
    "cooldown": 1.06,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 135.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "engineering": 0.5
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.01,
    "critChance": 0.15,
    "critMultiplier": 2.15,
    "range": 135.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "engineering": 0.5
    }
   },
   {
    "damage": 16.0,
    "cooldown": 0.98,
    "critChance": 0.2,
    "critMultiplier": 2.3,
    "range": 135.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 84,
    "scaling": {
     "engineering": 0.5
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.88,
    "critChance": 0.3,
    "critMultiplier": 2.5,
    "range": 135.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "engineering": 0.5
    }
   }
  ],
  "icon": "w-mine",
  "device": {
   "type": "mine",
   "max": 4,
   "radius": 65
  }
 },
 {
  "id": "scythe",
  "name": "镰臂",
  "kind": "melee",
  "classes": [
   "Legendary",
   "Ethereal"
  ],
  "damage": 24.96,
  "cooldown": 0.893,
  "range": 250.0,
  "scaling": {
   "melee": 1.5
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 24.96,
    "cooldown": 0.893,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5.0,
    "lifesteal": 1.0,
    "price": 26,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 45.38,
    "cooldown": 0.835,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5.0,
    "lifesteal": 1.0,
    "price": 74,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 82.5,
    "cooldown": 0.778,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5.0,
    "lifesteal": 1.0,
    "price": 230,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 150.0,
    "cooldown": 0.72,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5.0,
    "lifesteal": 1.0,
    "price": 756,
    "scaling": {
     "melee": 1.5
    }
   }
  ],
  "minTier": 3,
  "icon": "w-scythe",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "selfDamagePerSec": 3
  }
 },
 {
  "id": "sharp-tooth",
  "name": "尖牙刺",
  "kind": "melee",
  "classes": [
   "Primitive",
   "Precise"
  ],
  "damage": 5.0,
  "cooldown": 1.14,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 5.0,
    "cooldown": 1.14,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 8.0,
    "cooldown": 1.07,
    "critChance": 0.06,
    "critMultiplier": 2.15,
    "range": 160.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 11.0,
    "cooldown": 1.0,
    "critChance": 0.09,
    "critMultiplier": 2.3,
    "range": 170.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 72,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.93,
    "critChance": 0.12,
    "critMultiplier": 2.5,
    "range": 180.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 162,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-sharp-tooth",
  "iconShape": "tooth",
  "iconColor": "#e8e0c8",
  "melee": {
   "hitRadius": 20,
   "style": "flurry"
  },
  "special": {
   "lifestealPerMissingHp": 0.01
  }
 },
 {
  "id": "sickle",
  "name": "金龟子镰",
  "kind": "melee",
  "classes": [
   "Support"
  ],
  "damage": 5.0,
  "cooldown": 0.87,
  "range": 125.0,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 5.0,
    "cooldown": 0.87,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 8.0,
    "cooldown": 0.82,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 12.0,
    "cooldown": 0.77,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 74,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.7,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 125.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 162,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-scarab",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "damageVsLowHp": 0.4
  }
 },
 {
  "id": "spear",
  "name": "长角",
  "kind": "melee",
  "classes": [
   "Primitive"
  ],
  "damage": 15.0,
  "cooldown": 1.52,
  "range": 350.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 15.0,
    "cooldown": 1.52,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 25.0,
    "cooldown": 1.4,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 375.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 52,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 1.28,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 60.0,
    "cooldown": 1.24,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 360,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-horn",
  "melee": {
   "hitRadius": 20,
   "style": "charge"
  }
 },
 {
  "id": "spiky-shield",
  "name": "甲壳盾",
  "kind": "melee",
  "classes": [
   "Medieval",
   "Blunt"
  ],
  "damage": 10.0,
  "cooldown": 1.16,
  "range": 150.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 20.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.16,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.16,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 1.25
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.16,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.01,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 2.0
    }
   }
  ],
  "icon": "w-shellshield",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "bonusStats": {
   "armor": 2
  }
 },
 {
  "id": "spoon",
  "name": "汤匙",
  "kind": "melee",
  "classes": [
   "Blunt"
  ],
  "damage": 10.0,
  "cooldown": 1.06,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.06,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.99,
    "critChance": 0.0,
    "critMultiplier": 2.25,
    "range": 165.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.93,
    "critChance": 0.0,
    "critMultiplier": 2.5,
    "range": 180.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.86,
    "critChance": 0.0,
    "critMultiplier": 3.0,
    "range": 200.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-spoon",
  "iconShape": "spoon",
  "iconColor": "#c8d0dc",
  "melee": {
   "hitRadius": 20,
   "style": "snap"
  },
  "special": {
   "critVsBurning": true
  }
 },
 {
  "id": "stick",
  "name": "树枝",
  "kind": "melee",
  "classes": [
   "Primitive"
  ],
  "damage": 8.0,
  "cooldown": 1.29,
  "range": 175.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 8.0,
    "cooldown": 1.29,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 9.0,
    "cooldown": 1.22,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 10.0,
    "cooldown": 1.15,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 70,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.09,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 148,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-g-stick",
  "iconShape": "stick",
  "iconColor": "#a07848",
  "melee": {
   "hitRadius": 20,
   "style": "flurry"
  },
  "special": {
   "damagePerCopy": 4
  }
 },
 {
  "id": "sword",
  "name": "虫剑",
  "kind": "melee",
  "classes": [
   "Blade",
   "Medieval"
  ],
  "damage": 16.5,
  "cooldown": 1.382,
  "range": 200.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 16.5,
    "cooldown": 1.382,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.28,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 45.0,
    "cooldown": 1.13,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 148,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 65.0,
    "cooldown": 0.98,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 382,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-sword",
  "iconShape": "blade",
  "iconColor": "#c8d0dc",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "thief-dagger",
  "name": "盗蜜匕首",
  "kind": "melee",
  "classes": [
   "Precise"
  ],
  "damage": 6.0,
  "cooldown": 1.01,
  "range": 150.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 6.0,
    "cooldown": 1.01,
    "critChance": 0.2,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 12.0,
    "cooldown": 0.93,
    "critChance": 0.25,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 18.0,
    "cooldown": 0.86,
    "critChance": 0.3,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 88,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.73,
    "critChance": 0.4,
    "critMultiplier": 2.0,
    "range": 150.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "melee": 0.5
    }
   }
  ],
  "icon": "w-g-thief-dagger",
  "iconShape": "dagger",
  "iconColor": "#c8b060",
  "melee": {
   "hitRadius": 20,
   "style": "thrust"
  },
  "special": {
   "materialOnCritKill": 0.5
  }
 },
 {
  "id": "thunder-sword",
  "name": "雷刃",
  "kind": "melee",
  "classes": [
   "Blade",
   "Elemental"
  ],
  "damage": 12.1,
  "cooldown": 1.404,
  "range": 200.0,
  "scaling": {
   "melee": 1.25
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 12.1,
    "cooldown": 1.404,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.25
    }
   },
   {
    "damage": 22.0,
    "cooldown": 1.307,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 48,
    "scaling": {
     "melee": 1.25
    }
   },
   {
    "damage": 40.0,
    "cooldown": 1.21,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "melee": 1.25
    }
   },
   {
    "damage": 75.0,
    "cooldown": 1.06,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 426,
    "scaling": {
     "melee": 1.5
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-thunder-sword",
  "iconShape": "blade",
  "iconColor": "#7ac8ff",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "onHit": {
   "burst": {
    "count": 3,
    "damage": 0.5,
    "texture": "laserbolt",
    "radius": 5,
    "speed": 900
   }
  }
 },
 {
  "id": "torch",
  "name": "萤火棒",
  "kind": "melee",
  "classes": [
   "Primitive",
   "Elemental"
  ],
  "damage": 1.0,
  "cooldown": 1.1,
  "range": 175.0,
  "scaling": {
   "melee": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 20.0,
  "tiers": [
   {
    "damage": 1.0,
    "cooldown": 1.1,
    "critChance": 0.0,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "melee": 0.5
    }
   },
   {
    "damage": 1.0,
    "cooldown": 1.04,
    "critChance": 0.0,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 0.65
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.95,
    "critChance": 0.0,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 50,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.8,
    "critChance": 0.0,
    "critMultiplier": 1.5,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "icon": "w-firebeam",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "trident",
  "name": "三叉戟",
  "kind": "melee",
  "classes": [
   "Naval",
   "Medieval"
  ],
  "damage": 16.5,
  "cooldown": 1.706,
  "range": 325.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 16.5,
    "cooldown": 1.706,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.58,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 1.5,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 1.41,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-trident",
  "iconShape": "trident",
  "iconColor": "#c8a060",
  "melee": {
   "hitRadius": 20,
   "style": "charge"
  },
  "special": {
   "damageVsHighHp": 0.4
  }
 },
 {
  "id": "vorpal-sword",
  "name": "断首刃",
  "kind": "melee",
  "classes": [
   "Blade",
   "Medieval"
  ],
  "damage": 11.0,
  "cooldown": 1.199,
  "range": 200.0,
  "scaling": {
   "melee": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 11.0,
    "cooldown": 1.199,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.11,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 35.0,
    "cooldown": 1.03,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 124,
    "scaling": {
     "melee": 1.0
    }
   },
   {
    "damage": 55.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 338,
    "scaling": {
     "melee": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-vorpal-sword",
  "iconShape": "blade",
  "iconColor": "#d88cff",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  },
  "special": {
   "executeChance": 0.02
  }
 },
 {
  "id": "war-hammer",
  "name": "战锤",
  "kind": "melee",
  "classes": [
   "Blunt",
   "Tool"
  ],
  "damage": 30.25,
  "cooldown": 2.448,
  "range": 200.0,
  "scaling": {
   "melee": 1.5
  },
  "critMultiplier": 1.5,
  "knockback": 20.0,
  "tiers": [
   {
    "damage": 30.25,
    "cooldown": 2.448,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 55.0,
    "cooldown": 2.279,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 84,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 100.0,
    "cooldown": 2.11,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 268,
    "scaling": {
     "melee": 1.5
    }
   },
   {
    "damage": 200.0,
    "cooldown": 1.95,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 200.0,
    "knockback": 25.0,
    "lifesteal": 0,
    "price": 976,
    "scaling": {
     "melee": 2.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-war-hammer",
  "iconShape": "hammer",
  "iconColor": "#9a7a58",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "turretResetOnAttack": true
  }
 },
 {
  "id": "wrench",
  "name": "蚁丘炮台",
  "kind": "device",
  "classes": [
   "Tool"
  ],
  "damage": 12.0,
  "cooldown": 1.7,
  "range": 175.0,
  "scaling": {
   "engineering": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 20.0,
  "tiers": [
   {
    "damage": 12.0,
    "cooldown": 1.7,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "engineering": 1.0
    }
   },
   {
    "damage": 16.0,
    "cooldown": 1.64,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 42,
    "scaling": {
     "engineering": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.55,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "engineering": 1.0
    }
   },
   {
    "damage": 24.0,
    "cooldown": 1.49,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 175.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 202,
    "scaling": {
     "engineering": 1.0
    }
   }
  ],
  "icon": "w-turret",
  "device": {
   "type": "turret",
   "max": 2,
   "placeEvery": 5
  }
 },
 {
  "id": "blunderbuss",
  "name": "种子火铳",
  "kind": "ranged",
  "classes": [
   "Naval",
   "Gun"
  ],
  "damage": 12.1,
  "cooldown": 5.616,
  "range": 325.0,
  "scaling": {
   "ranged": 1.1
  },
  "critMultiplier": 2.0,
  "knockback": 10.0,
  "tiers": [
   {
    "damage": 12.1,
    "cooldown": 5.616,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 1.1
    }
   },
   {
    "damage": 22.0,
    "cooldown": 5.2,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 325.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 48,
    "scaling": {
     "ranged": 1.1
    }
   },
   {
    "damage": 45.0,
    "cooldown": 5.2,
    "critChance": 0.03,
    "critMultiplier": 2.25,
    "range": 350.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 148,
    "scaling": {
     "ranged": 1.35
    }
   },
   {
    "damage": 70.0,
    "cooldown": 5.2,
    "critChance": 0.03,
    "critMultiplier": 2.5,
    "range": 375.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 404,
    "scaling": {
     "ranged": 1.7
    }
   }
  ],
  "minTier": 1,
  "icon": "w-shotgun",
  "projectile": {
   "texture": "pellet",
   "speed": 900,
   "radius": 4.5,
   "pierce": 2,
   "spin": 0,
   "spread": 0.28,
   "count": 5,
   "arc": 0.5
  },
  "special": {
   "cooldownResetOnPickup": true
  }
 },
 {
  "id": "chain-gun",
  "name": "链式加特林",
  "kind": "ranged",
  "classes": [
   "Legendary",
   "Gun"
  ],
  "damage": 0.33,
  "cooldown": 0.091,
  "range": 500.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 0.33,
    "cooldown": 0.091,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 0.61,
    "cooldown": 0.085,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 24,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 1.1,
    "cooldown": 0.079,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 50,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 2.0,
    "cooldown": 0.073,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 104,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 3,
  "icon": "w-minigun",
  "projectile": {
   "texture": "bullet",
   "speed": 1050,
   "radius": 4,
   "pierce": 0,
   "spin": 0,
   "spread": 0.16
  }
 },
 {
  "id": "crossbow",
  "name": "松针弩",
  "kind": "ranged",
  "classes": [
   "Precise",
   "Medieval"
  ],
  "damage": 10.0,
  "cooldown": 1.13,
  "range": 350.0,
  "scaling": {
   "ranged": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 8.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.13,
    "critChance": 0.3,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.13,
    "critChance": 0.35,
    "critMultiplier": 1.75,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.13,
    "critChance": 0.4,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 80,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 18.0,
    "cooldown": 1.13,
    "critChance": 0.45,
    "critMultiplier": 2.25,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 176,
    "scaling": {
     "ranged": 0.5
    }
   }
  ],
  "icon": "w-pine",
  "projectile": {
   "texture": "needle",
   "speed": 900,
   "radius": 4,
   "pierce": 2,
   "spin": 0,
   "spread": 0
  },
  "special": {
   "pierceOnCrit": 2
  }
 },
 {
  "id": "double-barrel-shotgun",
  "name": "双管霰弹",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 3.0,
  "cooldown": 1.37,
  "range": 350.0,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 8.0,
  "tiers": [
   {
    "damage": 3.0,
    "cooldown": 1.37,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 6.0,
    "cooldown": 1.28,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "ranged": 0.85
    }
   },
   {
    "damage": 9.0,
    "cooldown": 1.2,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "ranged": 0.9
    }
   },
   {
    "damage": 9.0,
    "cooldown": 1.2,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 8.0,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-shotgun",
  "projectile": {
   "texture": "pellet",
   "speed": 880,
   "radius": 4.5,
   "pierce": 1,
   "spin": 0,
   "spread": 0.32,
   "count": 5,
   "arc": 0.55
  }
 },
 {
  "id": "fireball",
  "name": "火孢弹",
  "kind": "ranged",
  "classes": [
   "Explosive",
   "Elemental"
  ],
  "damage": 2.75,
  "cooldown": 1.21,
  "range": 400.0,
  "scaling": {
   "elemental": 0.25
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 2.75,
    "cooldown": 1.21,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "elemental": 0.25
    }
   },
   {
    "damage": 5.0,
    "cooldown": 1.12,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "elemental": 0.25
    }
   },
   {
    "damage": 10.0,
    "cooldown": 1.03,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 70,
    "scaling": {
     "elemental": 0.5
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.87,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "elemental": 0.75
    }
   }
  ],
  "minTier": 1,
  "icon": "w-spore",
  "projectile": {
   "texture": "flame",
   "speed": 620,
   "radius": 8,
   "pierce": 0,
   "spin": 4,
   "spread": 0.02,
   "explode": 60
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "flamethrower",
  "name": "爆燃喷囊",
  "kind": "ranged",
  "classes": [
   "Elemental",
   "Heavy"
  ],
  "damage": 0.55,
  "cooldown": 0.13,
  "range": 250.0,
  "scaling": {
   "elemental": 0.1
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 0.55,
    "cooldown": 0.13,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "elemental": 0.1
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.12,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 250.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "elemental": 0.1
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.12,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 50,
    "scaling": {
     "elemental": 0.1
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.09,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "elemental": 0.1
    }
   }
  ],
  "minTier": 1,
  "icon": "w-flamegland",
  "projectile": {
   "texture": "flame",
   "speed": 380,
   "radius": 10,
   "pierce": 99,
   "spin": 3,
   "spread": 0.25,
   "fade": true
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "flute",
  "name": "迷虫笛",
  "kind": "ranged",
  "classes": [
   "Musical"
  ],
  "damage": 6.0,
  "cooldown": 1.03,
  "range": 300.0,
  "scaling": {
   "ranged": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 6.0,
    "cooldown": 1.03,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 300.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 8.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 325.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 11.0,
    "cooldown": 0.87,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 72,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.78,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 375.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 162,
    "scaling": {
     "ranged": 0.5
    }
   }
  ],
  "icon": "w-g-flute",
  "iconShape": "flute",
  "iconColor": "#8ad8b0",
  "projectile": {
   "texture": "fluffseed",
   "speed": 620,
   "radius": 7,
   "pierce": 1,
   "spin": 3,
   "spread": 0.04
  }
 },
 {
  "id": "gatling-laser",
  "name": "加特林激光",
  "kind": "ranged",
  "classes": [
   "Legendary",
   "Heavy"
  ],
  "damage": 1.66,
  "cooldown": 0.091,
  "range": 500.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 3.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 1.66,
    "cooldown": 0.091,
    "critChance": 0.1,
    "critMultiplier": 3.0,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 3.03,
    "cooldown": 0.085,
    "critChance": 0.1,
    "critMultiplier": 3.0,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 5.5,
    "cooldown": 0.079,
    "critChance": 0.1,
    "critMultiplier": 3.0,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.073,
    "critChance": 0.1,
    "critMultiplier": 3.0,
    "range": 500.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 140,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 3,
  "icon": "w-lasergun",
  "projectile": {
   "texture": "laserbolt",
   "speed": 1250,
   "radius": 5,
   "pierce": 2,
   "spin": 0,
   "spread": 0
  }
 },
 {
  "id": "ghost-scepter",
  "name": "幽魂杖",
  "kind": "ranged",
  "classes": [
   "Ethereal"
  ],
  "damage": 10.0,
  "cooldown": 0.98,
  "range": 300.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 2.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 0.98,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.93,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.88,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.83,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 2.0,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-moths",
  "projectile": {
   "texture": "seed",
   "speed": 700,
   "radius": 6,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02
  },
  "special": {
   "growthMaxHp": 1
  }
 },
 {
  "id": "grenade-launcher",
  "name": "橡果榴弹炮",
  "kind": "ranged",
  "classes": [
   "Heavy",
   "Explosive"
  ],
  "damage": 6.6,
  "cooldown": 0.4,
  "range": 350.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 6.6,
    "cooldown": 0.4,
    "critChance": 0.05,
    "critMultiplier": 2.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 12.0,
    "cooldown": 0.37,
    "critChance": 0.05,
    "critMultiplier": 2.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 18.0,
    "cooldown": 0.37,
    "critChance": 0.1,
    "critMultiplier": 3.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 88,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.37,
    "critChance": 0.2,
    "critMultiplier": 3.5,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 228,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-acorn",
  "projectile": {
   "texture": "rocketproj",
   "speed": 650,
   "radius": 7,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02,
   "explode": 80
  }
 },
 {
  "id": "harpoon-gun",
  "name": "鱼叉炮",
  "kind": "ranged",
  "classes": [
   "Naval",
   "Gun"
  ],
  "damage": 2.75,
  "cooldown": 0.886,
  "range": 800.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 1.5,
  "knockback": -30.0,
  "tiers": [
   {
    "damage": 2.75,
    "cooldown": 0.886,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 800.0,
    "knockback": -30.0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 5.0,
    "cooldown": 0.82,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 800.0,
    "knockback": -30.0,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.73,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 850.0,
    "knockback": -30.0,
    "lifesteal": 0,
    "price": 70,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.65,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 900.0,
    "knockback": -30.0,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-harpoon-gun",
  "iconShape": "harpoon",
  "iconColor": "#8ac8d8",
  "projectile": {
   "texture": "stinger",
   "speed": 820,
   "radius": 5,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  },
  "onHit": {
   "slow": 0.3
  }
 },
 {
  "id": "icicle",
  "name": "霜露弹",
  "kind": "ranged",
  "classes": [
   "Precise",
   "Elemental"
  ],
  "damage": 10.0,
  "cooldown": 1.03,
  "range": 400.0,
  "scaling": {
   "elemental": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.03,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.95,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.87,
    "critChance": 0.15,
    "critMultiplier": 2.5,
    "range": 400.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 114,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 40.0,
    "cooldown": 0.7,
    "critChance": 0.2,
    "critMultiplier": 3.0,
    "range": 400.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 272,
    "scaling": {
     "elemental": 1.0
    }
   }
  ],
  "icon": "w-frostdew",
  "projectile": {
   "texture": "frostshot",
   "speed": 800,
   "radius": 6,
   "pierce": 1,
   "spin": 0,
   "spread": 0
  },
  "onHit": {
   "freeze": 1
  }
 },
 {
  "id": "javelin",
  "name": "投矛",
  "kind": "ranged",
  "classes": [
   "Primitive"
  ],
  "damage": 8.0,
  "cooldown": 1.2,
  "range": 350.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 8.0,
    "cooldown": 1.2,
    "critChance": 0.0,
    "critMultiplier": 2.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 12.0,
    "cooldown": 1.12,
    "critChance": 0.0,
    "critMultiplier": 2.75,
    "range": 375.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 16.0,
    "cooldown": 1.03,
    "critChance": 0.0,
    "critMultiplier": 3.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 84,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.95,
    "critChance": 0.0,
    "critMultiplier": 3.25,
    "range": 425.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-g-javelin",
  "iconShape": "javelin",
  "iconColor": "#c8a060",
  "projectile": {
   "texture": "stinger",
   "speed": 900,
   "radius": 4,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  }
 },
 {
  "id": "laser-gun",
  "name": "激光枪",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 40.0,
  "cooldown": 1.98,
  "range": 500.0,
  "scaling": {
   "ranged": 2.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 40.0,
    "cooldown": 1.98,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 55.0,
    "cooldown": 1.9,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 84,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 70.0,
    "cooldown": 1.82,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 202,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 100.0,
    "cooldown": 1.65,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 536,
    "scaling": {
     "ranged": 2.0
    }
   }
  ],
  "icon": "w-lasergun",
  "projectile": {
   "texture": "laserbolt",
   "speed": 1250,
   "radius": 5,
   "pierce": 2,
   "spin": 0,
   "spread": 0
  }
 },
 {
  "id": "medical-gun",
  "name": "蜂蜜罐",
  "kind": "ranged",
  "classes": [
   "Medical",
   "Gun"
  ],
  "damage": 10.0,
  "cooldown": 0.78,
  "range": 400.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 0.78,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0.5,
    "price": 18,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.7,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0.55,
    "price": 40,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.62,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0.6,
    "price": 92,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 0.48,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0.65,
    "price": 228,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-honeyjar",
  "projectile": {
   "texture": "honeyblob",
   "speed": 700,
   "radius": 6,
   "pierce": 0,
   "spin": 6,
   "spread": 0
  },
  "onHit": {
   "heal": 0.15
  }
 },
 {
  "id": "minigun",
  "name": "加特林",
  "kind": "ranged",
  "classes": [
   "Heavy",
   "Gun"
  ],
  "damage": 0.61,
  "cooldown": 0.104,
  "range": 400.0,
  "scaling": {
   "ranged": 0.5
  },
  "critMultiplier": 1.75,
  "knockback": 3.0,
  "tiers": [
   {
    "damage": 0.61,
    "cooldown": 0.104,
    "critChance": 0.01,
    "critMultiplier": 1.75,
    "range": 400.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 1.1,
    "cooldown": 0.097,
    "critChance": 0.01,
    "critMultiplier": 1.75,
    "range": 400.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 2.0,
    "cooldown": 0.09,
    "critChance": 0.01,
    "critMultiplier": 1.75,
    "range": 400.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 52,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 5.0,
    "cooldown": 0.09,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 3.0,
    "lifesteal": 0,
    "price": 118,
    "scaling": {
     "ranged": 0.75
    }
   }
  ],
  "minTier": 2,
  "icon": "w-minigun",
  "projectile": {
   "texture": "bullet",
   "speed": 1050,
   "radius": 4,
   "pierce": 1,
   "spin": 0,
   "spread": 0.16
  }
 },
 {
  "id": "nuclear-launcher",
  "name": "核果炮",
  "kind": "ranged",
  "classes": [
   "Heavy",
   "Explosive"
  ],
  "damage": 18.15,
  "cooldown": 2.459,
  "range": 800.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 18.15,
    "cooldown": 2.459,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 33.0,
    "cooldown": 2.29,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 60.0,
    "cooldown": 2.12,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 180,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 120.0,
    "cooldown": 2.12,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 624,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-rocket",
  "projectile": {
   "texture": "rocketproj",
   "speed": 650,
   "radius": 7,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02,
   "explode": 80
  }
 },
 {
  "id": "obliterator",
  "name": "湮灭枪",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Heavy"
  ],
  "damage": 75.63,
  "cooldown": 3.747,
  "range": 800.0,
  "scaling": {
   "ranged": 2.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 75.63,
    "cooldown": 3.747,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 54,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 137.5,
    "cooldown": 3.488,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 176,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 250.0,
    "cooldown": 3.23,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 598,
    "scaling": {
     "ranged": 2.0
    }
   },
   {
    "damage": 400.0,
    "cooldown": 3.23,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 1000.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 1856,
    "scaling": {
     "ranged": 2.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-obliterator",
  "iconShape": "laser",
  "iconColor": "#c88cff",
  "projectile": {
   "texture": "laserbolt",
   "speed": 1250,
   "radius": 5,
   "pierce": 2,
   "spin": 0,
   "spread": 0
  }
 },
 {
  "id": "particle-accelerator",
  "name": "粒子针",
  "kind": "ranged",
  "classes": [
   "Heavy",
   "Elemental"
  ],
  "damage": 18.15,
  "cooldown": 2.262,
  "range": 800.0,
  "scaling": {
   "elemental": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 18.15,
    "cooldown": 2.262,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 33.0,
    "cooldown": 2.106,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 60.0,
    "cooldown": 1.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 180,
    "scaling": {
     "elemental": 1.0
    }
   },
   {
    "damage": 120.0,
    "cooldown": 1.62,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 800.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 624,
    "scaling": {
     "elemental": 1.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-g-particle-accelerator",
  "iconShape": "beam",
  "iconColor": "#8ce8ff",
  "projectile": {
   "texture": "flame",
   "speed": 380,
   "radius": 10,
   "pierce": 99,
   "spin": 3,
   "spread": 0.25,
   "fade": true
  },
  "onHit": {
   "burn": true,
   "slow": 0.3
  }
 },
 {
  "id": "pistol",
  "name": "种子手枪",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 12.0,
  "cooldown": 1.2,
  "range": 400.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 12.0,
    "cooldown": 1.2,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.12,
    "critChance": 0.15,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.03,
    "critChance": 0.2,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 114,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 0.87,
    "critChance": 0.25,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 316,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-pistol",
  "projectile": {
   "texture": "bullet",
   "speed": 980,
   "radius": 4.5,
   "pierce": 1,
   "spin": 0,
   "spread": 0.02
  }
 },
 {
  "id": "potato-thrower",
  "name": "花粉投手",
  "kind": "ranged",
  "classes": [
   "Support"
  ],
  "damage": 1.65,
  "cooldown": 0.486,
  "range": 500.0,
  "scaling": {
   "ranged": 0.4
  },
  "critMultiplier": 1.5,
  "knockback": 20.0,
  "tiers": [
   {
    "damage": 1.65,
    "cooldown": 0.486,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "ranged": 0.4
    }
   },
   {
    "damage": 3.0,
    "cooldown": 0.45,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 20.0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "ranged": 0.4
    }
   },
   {
    "damage": 5.0,
    "cooldown": 0.37,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 25.0,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "ranged": 0.4
    }
   },
   {
    "damage": 10.0,
    "cooldown": 0.28,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 500.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 140,
    "scaling": {
     "ranged": 0.4
    }
   }
  ],
  "minTier": 1,
  "icon": "w-g-potato-thrower",
  "iconShape": "launcher",
  "iconColor": "#c8b070",
  "projectile": {
   "texture": "seed",
   "speed": 650,
   "radius": 7,
   "pierce": 0,
   "spin": 8,
   "spread": 0.08
  }
 },
 {
  "id": "railgun",
  "name": "露珠狙击",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Heavy"
  ],
  "damage": 10.0,
  "cooldown": 1.07,
  "range": 300.0,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.07,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.02,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.98,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 35.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 250,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "icon": "w-dewsniper",
  "projectile": {
   "texture": "heavybullet",
   "speed": 1300,
   "radius": 5,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  },
  "special": {
   "rampingDamage": 3
  }
 },
 {
  "id": "revolver",
  "name": "树脂左轮",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 15.0,
  "cooldown": 0.43,
  "range": 450.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 15.0,
    "cooldown": 0.43,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 20.0,
    "cooldown": 0.42,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 46,
    "scaling": {
     "ranged": 1.3
    }
   },
   {
    "damage": 25.0,
    "cooldown": 0.4,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 104,
    "scaling": {
     "ranged": 1.65
    }
   },
   {
    "damage": 40.0,
    "cooldown": 0.38,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 272,
    "scaling": {
     "ranged": 2.0
    }
   }
  ],
  "icon": "w-revolver",
  "projectile": {
   "texture": "bullet",
   "speed": 980,
   "radius": 4.5,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02
  }
 },
 {
  "id": "rocket-launcher",
  "name": "橡果火箭筒",
  "kind": "ranged",
  "classes": [
   "Heavy",
   "Explosive"
  ],
  "damage": 16.5,
  "cooldown": 1.922,
  "range": 500.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 2.0,
  "knockback": 15.0,
  "tiers": [
   {
    "damage": 16.5,
    "cooldown": 1.922,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 22,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 30.0,
    "cooldown": 1.78,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 500.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 1.37,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 550.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 1.03,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 600.0,
    "knockback": 15.0,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 1,
  "icon": "w-rocket",
  "projectile": {
   "texture": "rocketproj",
   "speed": 650,
   "radius": 7,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02,
   "explode": 80
  }
 },
 {
  "id": "shredder",
  "name": "碎甲枪",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Explosive"
  ],
  "damage": 5.0,
  "cooldown": 1.3,
  "range": 450.0,
  "scaling": {
   "ranged": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 5.0,
    "cooldown": 1.3,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 10.0,
    "cooldown": 1.22,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 36,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 15.0,
    "cooldown": 1.13,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 80,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 25.0,
    "cooldown": 1.05,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 450.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "ranged": 0.5
    }
   }
  ],
  "icon": "w-g-shredder",
  "iconShape": "shotgun",
  "iconColor": "#c8d0dc",
  "projectile": {
   "texture": "pellet",
   "speed": 880,
   "radius": 4.5,
   "pierce": 1,
   "spin": 0,
   "spread": 0.32,
   "count": 5,
   "arc": 0.55
  },
  "special": {
   "explodeChance": 0.4,
   "explodeRadius": 55
  }
 },
 {
  "id": "shuriken",
  "name": "飞叶镖",
  "kind": "ranged",
  "classes": [
   "Precise"
  ],
  "damage": 7.0,
  "cooldown": 0.87,
  "range": 350.0,
  "scaling": {
   "ranged": 0.25
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 7.0,
    "cooldown": 0.87,
    "critChance": 0.35,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.25
    }
   },
   {
    "damage": 9.0,
    "cooldown": 0.83,
    "critChance": 0.38,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "ranged": 0.34
    }
   },
   {
    "damage": 11.0,
    "cooldown": 0.8,
    "critChance": 0.41,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 72,
    "scaling": {
     "ranged": 0.42
    }
   },
   {
    "damage": 15.0,
    "cooldown": 0.7,
    "critChance": 0.45,
    "critMultiplier": 1.5,
    "range": 350.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 162,
    "scaling": {
     "ranged": 0.5
    }
   }
  ],
  "icon": "w-skipstone",
  "projectile": {
   "texture": "pebble",
   "speed": 720,
   "radius": 6,
   "pierce": 0,
   "spin": 12,
   "spread": 0,
   "bounce": {
    "times": 4,
    "range": 150,
    "falloff": 0.15
   }
  },
  "special": {
   "bounceOnCrit": 2
  }
 },
 {
  "id": "slingshot",
  "name": "种子弹弓",
  "kind": "ranged",
  "classes": [
   "Primitive"
  ],
  "damage": 10.0,
  "cooldown": 1.22,
  "range": 300.0,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 5.0,
  "tiers": [
   {
    "damage": 10.0,
    "cooldown": 1.22,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 13.0,
    "cooldown": 1.17,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 16.0,
    "cooldown": 1.13,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 84,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 20.0,
    "cooldown": 1.1,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 300.0,
    "knockback": 5.0,
    "lifesteal": 0,
    "price": 184,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-slingshot",
  "projectile": {
   "texture": "pebble",
   "speed": 720,
   "radius": 6,
   "pierce": 0,
   "spin": 12,
   "spread": 0,
   "bounce": {
    "times": 4,
    "range": 150,
    "falloff": 0.15
   }
  }
 },
 {
  "id": "smg",
  "name": "冲锋枪",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 3.0,
  "cooldown": 0.17,
  "range": 400.0,
  "scaling": {
   "ranged": 0.5
  },
  "critMultiplier": 1.5,
  "knockback": 5,
  "tiers": [
   {
    "damage": 3.0,
    "cooldown": 0.17,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.5
    }
   },
   {
    "damage": 4.0,
    "cooldown": 0.17,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "ranged": 0.6
    }
   },
   {
    "damage": 5.0,
    "cooldown": 0.17,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 60,
    "scaling": {
     "ranged": 0.7
    }
   },
   {
    "damage": 8.0,
    "cooldown": 0.15,
    "critChance": 0.01,
    "critMultiplier": 1.5,
    "range": 400.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 132,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-smg",
  "projectile": {
   "texture": "bullet",
   "speed": 1050,
   "radius": 4,
   "pierce": 0,
   "spin": 0,
   "spread": 0.16
  }
 },
 {
  "id": "sniper-gun",
  "name": "狙击枪",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Precise"
  ],
  "damage": 15.13,
  "cooldown": 2.784,
  "range": 800.0,
  "scaling": {
   "ranged": 1.0
  },
  "critMultiplier": 3.0,
  "knockback": 30.0,
  "tiers": [
   {
    "damage": 15.13,
    "cooldown": 2.784,
    "critChance": 0.2,
    "critMultiplier": 3.0,
    "range": 800.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 27.5,
    "cooldown": 2.592,
    "critChance": 0.2,
    "critMultiplier": 3.0,
    "range": 800.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 54,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 50.0,
    "cooldown": 2.4,
    "critChance": 0.2,
    "critMultiplier": 3.0,
    "range": 800.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "ranged": 1.0
    }
   },
   {
    "damage": 80.0,
    "cooldown": 2.4,
    "critChance": 0.2,
    "critMultiplier": 4.0,
    "range": 1000.0,
    "knockback": 30.0,
    "lifesteal": 0,
    "price": 448,
    "scaling": {
     "ranged": 1.0
    }
   }
  ],
  "minTier": 2,
  "icon": "w-snipergun",
  "projectile": {
   "texture": "heavybullet",
   "speed": 1300,
   "radius": 5,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  },
  "onHit": {
   "burst": {
    "count": 4,
    "damage": 0.6,
    "texture": "needle",
    "radius": 4,
    "speed": 820
   }
  }
 },
 {
  "id": "taser",
  "name": "电击针",
  "kind": "ranged",
  "classes": [
   "Support",
   "Elemental"
  ],
  "damage": 7.0,
  "cooldown": 0.95,
  "range": 200.0,
  "scaling": {
   "elemental": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 5,
  "tiers": [
   {
    "damage": 7.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "elemental": 0.8
    }
   },
   {
    "damage": 7.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "elemental": 0.7
    }
   },
   {
    "damage": 7.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 64,
    "scaling": {
     "elemental": 0.6
    }
   },
   {
    "damage": 14.0,
    "cooldown": 0.95,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 200.0,
    "knockback": 5,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "elemental": 0.5
    }
   }
  ],
  "icon": "w-web",
  "projectile": {
   "texture": "frostshot",
   "speed": 760,
   "radius": 6,
   "pierce": 1,
   "spin": 0,
   "spread": 0
  },
  "onHit": {
   "slow": 0.3
  }
 },
 {
  "id": "wand",
  "name": "萤火魔杖",
  "kind": "ranged",
  "classes": [
   "Elemental"
  ],
  "damage": 1.0,
  "cooldown": 0.87,
  "range": 350.0,
  "scaling": {
   "elemental": 0.5
  },
  "critMultiplier": 2.0,
  "knockback": 10.0,
  "tiers": [
   {
    "damage": 1.0,
    "cooldown": 0.87,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 350.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 12,
    "scaling": {
     "elemental": 0.5
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.78,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 375.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "elemental": 0.65
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.7,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 400.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 50,
    "scaling": {
     "elemental": 0.8
    }
   },
   {
    "damage": 1.0,
    "cooldown": 0.53,
    "critChance": 0.0,
    "critMultiplier": 2.0,
    "range": 425.0,
    "knockback": 10.0,
    "lifesteal": 0,
    "price": 100,
    "scaling": {
     "elemental": 1.0
    }
   }
  ],
  "icon": "w-firebeam",
  "projectile": {
   "texture": "flame",
   "speed": 560,
   "radius": 7,
   "pierce": 1,
   "spin": 5,
   "spread": 0.05
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "awl",
  "name": "锥刺",
  "kind": "melee",
  "classes": [
   "Tool"
  ],
  "damage": 10,
  "cooldown": 1.06,
  "range": 135,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 0,
  "tiers": [
   {
    "damage": 10,
    "cooldown": 1.06,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 135,
    "knockback": 0,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15,
    "cooldown": 1.01,
    "critChance": 0.15,
    "critMultiplier": 2.15,
    "range": 135,
    "knockback": 0,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 20,
    "cooldown": 0.98,
    "critChance": 0.2,
    "critMultiplier": 2.3,
    "range": 135,
    "knockback": 0,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 25,
    "cooldown": 0.88,
    "critChance": 0.3,
    "critMultiplier": 2.5,
    "range": 135,
    "knockback": 0,
    "lifesteal": 0,
    "price": 206,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-armorbreak",
  "melee": {
   "hitRadius": 20,
   "style": "charge"
  },
  "special": {
   "explodeChance": 0,
   "turretResetOnAttack": true
  }
 },
 {
  "id": "cestus",
  "name": "拳甲",
  "kind": "melee",
  "classes": [
   "Blunt",
   "Unarmed"
  ],
  "damage": 25,
  "cooldown": 1.29,
  "range": 140,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 10,
  "tiers": [
   {
    "damage": 25,
    "cooldown": 1.29,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 140,
    "knockback": 10,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 40,
    "cooldown": 1.24,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 140,
    "knockback": 10,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 60,
    "cooldown": 1.17,
    "critChance": 0.08,
    "critMultiplier": 2.1,
    "range": 145,
    "knockback": 10,
    "lifesteal": 0,
    "price": 180,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 90,
    "cooldown": 1.1,
    "critChance": 0.12,
    "critMultiplier": 2.2,
    "range": 150,
    "knockback": 10,
    "lifesteal": 0,
    "price": 492,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-cestus",
  "iconShape": "fist",
  "iconColor": "#c88a58",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  }
 },
 {
  "id": "crowbar",
  "name": "撬棍",
  "kind": "melee",
  "classes": [
   "Tool"
  ],
  "damage": 14,
  "cooldown": 1.8,
  "range": 150,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 8,
  "tiers": [
   {
    "damage": 14,
    "cooldown": 1.8,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150,
    "knockback": 8,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 18,
    "cooldown": 1.72,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150,
    "knockback": 8,
    "lifesteal": 0,
    "price": 44,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 23,
    "cooldown": 1.65,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 155,
    "knockback": 8,
    "lifesteal": 0,
    "price": 98,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 28,
    "cooldown": 1.59,
    "critChance": 0.08,
    "critMultiplier": 2.1,
    "range": 160,
    "knockback": 8,
    "lifesteal": 0,
    "price": 220,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-crowbar",
  "iconShape": "crowbar",
  "iconColor": "#a06040",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "stationaryPenalty": {
    "damagePct": -0.1,
    "speedPct": 0
   }
  }
 },
 {
  "id": "flail",
  "name": "流星锤",
  "kind": "melee",
  "classes": [
   "Medieval",
   "Primitive"
  ],
  "damage": 11,
  "cooldown": 1.36,
  "range": 170,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 8,
  "tiers": [
   {
    "damage": 11,
    "cooldown": 1.36,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 170,
    "knockback": 8,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15,
    "cooldown": 1.32,
    "critChance": 0.08,
    "critMultiplier": 2.0,
    "range": 175,
    "knockback": 8,
    "lifesteal": 0,
    "price": 40,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 20,
    "cooldown": 1.26,
    "critChance": 0.11,
    "critMultiplier": 2.1,
    "range": 180,
    "knockback": 8,
    "lifesteal": 0,
    "price": 92,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 27,
    "cooldown": 1.21,
    "critChance": 0.15,
    "critMultiplier": 2.2,
    "range": 185,
    "knockback": 8,
    "lifesteal": 0,
    "price": 214,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-flail",
  "iconShape": "flail",
  "iconColor": "#9a8a78",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "light-saber",
  "name": "光刃",
  "kind": "melee",
  "classes": [
   "Blade",
   "Precise"
  ],
  "damage": 24,
  "cooldown": 1.04,
  "range": 160,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 6,
  "tiers": [
   {
    "damage": 24,
    "cooldown": 1.04,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 160,
    "knockback": 6,
    "lifesteal": 0,
    "price": 26,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 29,
    "cooldown": 1.0,
    "critChance": 0.15,
    "critMultiplier": 2.1,
    "range": 165,
    "knockback": 6,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 34,
    "cooldown": 0.96,
    "critChance": 0.2,
    "critMultiplier": 2.2,
    "range": 170,
    "knockback": 6,
    "lifesteal": 0,
    "price": 122,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 38,
    "cooldown": 0.92,
    "critChance": 0.25,
    "critMultiplier": 2.3,
    "range": 175,
    "knockback": 6,
    "lifesteal": 0,
    "price": 264,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-light-saber",
  "iconShape": "saber",
  "iconColor": "#6cf2ff",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "meat-tenderizer",
  "name": "碎肉锤",
  "kind": "melee",
  "classes": [
   "Blunt",
   "Medical"
  ],
  "damage": 15,
  "cooldown": 1.5,
  "range": 145,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 12,
  "tiers": [
   {
    "damage": 15,
    "cooldown": 1.5,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 145,
    "knockback": 12,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 25,
    "cooldown": 1.42,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 150,
    "knockback": 12,
    "lifesteal": 0,
    "price": 52,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 45,
    "cooldown": 1.33,
    "critChance": 0.05,
    "critMultiplier": 2.1,
    "range": 155,
    "knockback": 12,
    "lifesteal": 0,
    "price": 148,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 75,
    "cooldown": 1.25,
    "critChance": 0.08,
    "critMultiplier": 2.2,
    "range": 160,
    "knockback": 12,
    "lifesteal": 0,
    "price": 426,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-meat-tenderizer",
  "iconShape": "hammer",
  "iconColor": "#c87858",
  "melee": {
   "hitRadius": 20,
   "style": "bash"
  },
  "special": {
   "healOnKill": 1
  }
 },
 {
  "id": "shovel",
  "name": "甲壳铲",
  "kind": "melee",
  "classes": [
   "Blunt",
   "Tool"
  ],
  "damage": 12,
  "cooldown": 1.36,
  "range": 155,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 10,
  "tiers": [
   {
    "damage": 12,
    "cooldown": 1.36,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 155,
    "knockback": 10,
    "lifesteal": 0,
    "price": 18,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 22,
    "cooldown": 1.32,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 160,
    "knockback": 10,
    "lifesteal": 0,
    "price": 48,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 42,
    "cooldown": 1.26,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 165,
    "knockback": 10,
    "lifesteal": 0,
    "price": 140,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 68,
    "cooldown": 1.21,
    "critChance": 0.08,
    "critMultiplier": 2.1,
    "range": 170,
    "knockback": 10,
    "lifesteal": 0,
    "price": 396,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-shovel",
  "iconShape": "shovel",
  "iconColor": "#a89060",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "whip",
  "name": "虫鞭",
  "kind": "melee",
  "classes": [
   "Primitive"
  ],
  "damage": 8,
  "cooldown": 1.03,
  "range": 180,
  "scaling": {
   "melee": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 4,
  "tiers": [
   {
    "damage": 8,
    "cooldown": 1.03,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 180,
    "knockback": 4,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 11,
    "cooldown": 0.99,
    "critChance": 0.08,
    "critMultiplier": 2.0,
    "range": 185,
    "knockback": 4,
    "lifesteal": 0,
    "price": 36,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 15,
    "cooldown": 0.94,
    "critChance": 0.11,
    "critMultiplier": 2.1,
    "range": 190,
    "knockback": 4,
    "lifesteal": 0,
    "price": 80,
    "scaling": {
     "melee": 0.8
    }
   },
   {
    "damage": 21,
    "cooldown": 0.88,
    "critChance": 0.15,
    "critMultiplier": 2.2,
    "range": 195,
    "knockback": 4,
    "lifesteal": 0,
    "price": 188,
    "scaling": {
     "melee": 0.8
    }
   }
  ],
  "icon": "w-g-whip",
  "iconShape": "whip",
  "iconColor": "#c8a060",
  "melee": {
   "hitRadius": 20,
   "style": "sweep",
   "arc": 1.0
  }
 },
 {
  "id": "blowgun",
  "name": "吹箭",
  "kind": "ranged",
  "classes": [
   "Precise",
   "Primitive"
  ],
  "damage": 5,
  "cooldown": 0.62,
  "range": 300,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 2,
  "tiers": [
   {
    "damage": 5,
    "cooldown": 0.62,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 300,
    "knockback": 2,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 7,
    "cooldown": 0.53,
    "critChance": 0.08,
    "critMultiplier": 2.0,
    "range": 310,
    "knockback": 2,
    "lifesteal": 0,
    "price": 32,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 9,
    "cooldown": 0.45,
    "critChance": 0.12,
    "critMultiplier": 2.1,
    "range": 320,
    "knockback": 2,
    "lifesteal": 0,
    "price": 68,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 11,
    "cooldown": 0.37,
    "critChance": 0.18,
    "critMultiplier": 2.2,
    "range": 330,
    "knockback": 2,
    "lifesteal": 0,
    "price": 144,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-stinger",
  "projectile": {
   "texture": "needle",
   "speed": 900,
   "radius": 4,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  },
  "onHit": {
   "poison": 1
  }
 },
 {
  "id": "boomerang",
  "name": "回旋叶刃",
  "kind": "ranged",
  "classes": [
   "Primitive"
  ],
  "damage": 6,
  "cooldown": 0.7,
  "range": 250,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 4,
  "tiers": [
   {
    "damage": 6,
    "cooldown": 0.7,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 250,
    "knockback": 4,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 9,
    "cooldown": 0.67,
    "critChance": 0.08,
    "critMultiplier": 2.0,
    "range": 260,
    "knockback": 4,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 12,
    "cooldown": 0.63,
    "critChance": 0.1,
    "critMultiplier": 2.1,
    "range": 270,
    "knockback": 4,
    "lifesteal": 0,
    "price": 74,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 17,
    "cooldown": 0.6,
    "critChance": 0.15,
    "critMultiplier": 2.2,
    "range": 280,
    "knockback": 4,
    "lifesteal": 0,
    "price": 170,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-boomerang",
  "projectile": {
   "texture": "leafblade",
   "speed": 720,
   "radius": 6,
   "pierce": 0,
   "spin": 12,
   "spread": 0,
   "returning": true
  }
 },
 {
  "id": "carbon-bow",
  "name": "碳弓",
  "kind": "ranged",
  "classes": [
   "Precise"
  ],
  "damage": 7,
  "cooldown": 0.8,
  "range": 350,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 4,
  "tiers": [
   {
    "damage": 7,
    "cooldown": 0.8,
    "critChance": 0.15,
    "critMultiplier": 2.0,
    "range": 350,
    "knockback": 4,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 9,
    "cooldown": 0.77,
    "critChance": 0.18,
    "critMultiplier": 2.0,
    "range": 360,
    "knockback": 4,
    "lifesteal": 0,
    "price": 34,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 11,
    "cooldown": 0.73,
    "critChance": 0.22,
    "critMultiplier": 2.1,
    "range": 370,
    "knockback": 4,
    "lifesteal": 0,
    "price": 72,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 13,
    "cooldown": 0.7,
    "critChance": 0.28,
    "critMultiplier": 2.2,
    "range": 380,
    "knockback": 4,
    "lifesteal": 0,
    "price": 154,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-pine",
  "projectile": {
   "texture": "needle",
   "speed": 900,
   "radius": 4,
   "pierce": 3,
   "spin": 0,
   "spread": 0
  }
 },
 {
  "id": "combat-shotgun",
  "name": "战斗霰弹",
  "kind": "ranged",
  "classes": [
   "Gun"
  ],
  "damage": 7,
  "cooldown": 0.55,
  "range": 220,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 6,
  "tiers": [
   {
    "damage": 7,
    "cooldown": 0.55,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 220,
    "knockback": 6,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 10,
    "cooldown": 0.53,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 225,
    "knockback": 6,
    "lifesteal": 0,
    "price": 36,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 10,
    "cooldown": 0.51,
    "critChance": 0.05,
    "critMultiplier": 2.0,
    "range": 230,
    "knockback": 8,
    "lifesteal": 0,
    "price": 70,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 14,
    "cooldown": 0.5,
    "critChance": 0.08,
    "critMultiplier": 2.1,
    "range": 235,
    "knockback": 8,
    "lifesteal": 0,
    "price": 158,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-shotgun",
  "projectile": {
   "texture": "pellet",
   "speed": 880,
   "radius": 4.5,
   "pierce": 1,
   "spin": 0,
   "spread": 0.32,
   "count": 5,
   "arc": 0.55
  }
 },
 {
  "id": "machine-gun",
  "name": "机枪",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Heavy"
  ],
  "damage": 2,
  "cooldown": 0.09,
  "range": 230,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 1.5,
  "knockback": 2,
  "tiers": [
   {
    "damage": 2,
    "cooldown": 0.09,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 230,
    "knockback": 2,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 3,
    "cooldown": 0.085,
    "critChance": 0.03,
    "critMultiplier": 1.5,
    "range": 235,
    "knockback": 2,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 4,
    "cooldown": 0.08,
    "critChance": 0.05,
    "critMultiplier": 1.5,
    "range": 240,
    "knockback": 2,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 6,
    "cooldown": 0.073,
    "critChance": 0.08,
    "critMultiplier": 1.6,
    "range": 245,
    "knockback": 2,
    "lifesteal": 0,
    "price": 122,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-minigun",
  "projectile": {
   "texture": "bullet",
   "speed": 1050,
   "radius": 4,
   "pierce": 0,
   "spin": 0,
   "spread": 0.16
  }
 },
 {
  "id": "molotov",
  "name": "燃脂瓶",
  "kind": "ranged",
  "classes": [
   "Elemental"
  ],
  "damage": 4,
  "cooldown": 1.7,
  "range": 280,
  "scaling": {
   "elemental": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 0,
  "tiers": [
   {
    "damage": 4,
    "cooldown": 1.7,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 280,
    "knockback": 0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "elemental": 0.8
    }
   },
   {
    "damage": 6,
    "cooldown": 1.62,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 285,
    "knockback": 0,
    "lifesteal": 0,
    "price": 30,
    "scaling": {
     "elemental": 0.8
    }
   },
   {
    "damage": 8,
    "cooldown": 1.54,
    "critChance": 0.05,
    "critMultiplier": 2.1,
    "range": 290,
    "knockback": 0,
    "lifesteal": 0,
    "price": 66,
    "scaling": {
     "elemental": 0.8
    }
   },
   {
    "damage": 12,
    "cooldown": 1.45,
    "critChance": 0.08,
    "critMultiplier": 2.2,
    "range": 295,
    "knockback": 0,
    "lifesteal": 0,
    "price": 148,
    "scaling": {
     "elemental": 0.8
    }
   }
  ],
  "icon": "w-g-molotov",
  "iconShape": "molotov",
  "iconColor": "#ff8a30",
  "projectile": {
   "texture": "flame",
   "speed": 480,
   "radius": 8,
   "pierce": 0,
   "spin": 5,
   "spread": 0.02,
   "explode": 65
  },
  "onHit": {
   "burn": true
  }
 },
 {
  "id": "pan-flute",
  "name": "排笛",
  "kind": "ranged",
  "classes": [
   "Musical"
  ],
  "damage": 2,
  "cooldown": 1.28,
  "range": 260,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 0,
  "tiers": [
   {
    "damage": 2,
    "cooldown": 1.28,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 260,
    "knockback": 0,
    "lifesteal": 0,
    "price": 14,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 3,
    "cooldown": 1.2,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 265,
    "knockback": 0,
    "lifesteal": 0,
    "price": 28,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 4,
    "cooldown": 1.12,
    "critChance": 0.05,
    "critMultiplier": 2.1,
    "range": 270,
    "knockback": 0,
    "lifesteal": 0,
    "price": 56,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 6,
    "cooldown": 1.03,
    "critChance": 0.08,
    "critMultiplier": 2.2,
    "range": 275,
    "knockback": 0,
    "lifesteal": 0,
    "price": 122,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-g-pan-flute",
  "iconShape": "panflute",
  "iconColor": "#8ad8b0",
  "projectile": {
   "texture": "fluffseed",
   "speed": 650,
   "radius": 6,
   "pierce": 0,
   "spin": 4,
   "spread": 0.06,
   "count": 5,
   "arc": 0.5
  }
 },
 {
  "id": "sticky-grenade",
  "name": "黏性雷",
  "kind": "ranged",
  "classes": [
   "Explosive"
  ],
  "damage": 8,
  "cooldown": 1.7,
  "range": 280,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 8,
  "tiers": [
   {
    "damage": 8,
    "cooldown": 1.7,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 280,
    "knockback": 8,
    "lifesteal": 0,
    "price": 16,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 13,
    "cooldown": 1.62,
    "critChance": 0.03,
    "critMultiplier": 2.0,
    "range": 285,
    "knockback": 8,
    "lifesteal": 0,
    "price": 38,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 19,
    "cooldown": 1.54,
    "critChance": 0.05,
    "critMultiplier": 2.1,
    "range": 290,
    "knockback": 8,
    "lifesteal": 0,
    "price": 90,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 28,
    "cooldown": 1.45,
    "critChance": 0.08,
    "critMultiplier": 2.2,
    "range": 295,
    "knockback": 8,
    "lifesteal": 0,
    "price": 220,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-acorn",
  "projectile": {
   "texture": "acorn",
   "speed": 650,
   "radius": 7,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02,
   "explode": 80
  }
 },
 {
  "id": "tranq-rifle",
  "name": "蜂刺吹针",
  "kind": "ranged",
  "classes": [
   "Gun",
   "Precise"
  ],
  "damage": 15,
  "cooldown": 2.12,
  "range": 380,
  "scaling": {
   "ranged": 0.8
  },
  "critMultiplier": 2.0,
  "knockback": 4,
  "tiers": [
   {
    "damage": 15,
    "cooldown": 2.12,
    "critChance": 0.1,
    "critMultiplier": 2.0,
    "range": 380,
    "knockback": 4,
    "lifesteal": 0,
    "price": 20,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 25,
    "cooldown": 2.08,
    "critChance": 0.15,
    "critMultiplier": 2.1,
    "range": 385,
    "knockback": 4,
    "lifesteal": 0,
    "price": 52,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 40,
    "cooldown": 2.05,
    "critChance": 0.2,
    "critMultiplier": 2.2,
    "range": 390,
    "knockback": 4,
    "lifesteal": 0,
    "price": 136,
    "scaling": {
     "ranged": 0.8
    }
   },
   {
    "damage": 60,
    "cooldown": 2.03,
    "critChance": 0.25,
    "critMultiplier": 2.3,
    "range": 395,
    "knockback": 4,
    "lifesteal": 0,
    "price": 360,
    "scaling": {
     "ranged": 0.8
    }
   }
  ],
  "icon": "w-stinger",
  "projectile": {
   "texture": "bullet",
   "speed": 980,
   "radius": 4.5,
   "pierce": 0,
   "spin": 0,
   "spread": 0.02
  },
  "onHit": {
   "slow": 0.3
  }
 }
];
