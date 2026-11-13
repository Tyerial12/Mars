export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type CameraPreset = 'ISOMETRIC' | 'TOP_DOWN' | 'SURFACE';

export type TerrainType = 'REGOLITH' | 'ICE_VEIN' | 'ORE_DEPOSIT' | 'CRATER_BASIN' | 'RIDGE';

export type BuildingType =
  | 'SOLAR_ARRAY'
  | 'RTG_REACTOR'
  | 'BATTERY_HUB'
  | 'WATER_EXTRACTOR'
  | 'OXYGEN_PLANT'
  | 'HAB_DOME'
  | 'BIODOME'
  | 'ORE_DRILL'
  | 'ATMO_PROCESSOR'
  | 'LAUNCHPAD'
  | 'MAINTENANCE_HUB';

export type BuildingCategory = 'ALL' | 'POWER_WATER' | 'LIFE_SUPPORT' | 'INDUSTRY_TERRAFORM';

export interface ResourceValues {
  oxygen: number;
  water: number;
  energy: number;
  minerals: number;
  food: number;
  credits: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  shortName: string;
  category: Exclude<BuildingCategory, 'ALL'>;
  description: string;
  cost: {
    minerals: number;
    credits: number;
  };
  production: Partial<ResourceValues>;
  consumption: Partial<ResourceValues>;
  storageBonus?: Partial<ResourceValues>;
  housingBonus?: number;
  terraformingRate?: {
    atmosphere: number;
    hydrosphere: number;
    biosphere: number;
  };
  allowedTerrains: TerrainType[];
  stormVulnerable?: boolean;
  accentColor: string;
}

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  level: number; // 1 to 3
  powered: boolean;
  enabled: boolean; // Player can toggle off during dust storms
  dustDamage: number; // 0 to 100
  constructedSol: number;
}

export interface TileData {
  x: number;
  z: number;
  elevation: number; // 0 = basin, 1 = plain, 2 = ridge
  terrain: TerrainType;
  building: BuildingInstance | null;
  moisture: number; // 0 to 100, rises with terraforming
}

export interface TerraformingState {
  atmosphere: number; // 0 to 100 (O2 & pressure)
  hydrosphere: number; // 0 to 100 (Aquifers & surface water)
  biosphere: number; // 0 to 100 (Microbes, moss & biodomes)
  totalIndex: number; // 0 to 100 average
}

export type StormTier = 0 | 1 | 2 | 3;

export interface WeatherState {
  status: 'CLEAR' | 'STORM_WARNING' | 'ACTIVE_STORM';
  stormTier: StormTier;
  stormName: string;
  countdownSols: number; // Sols until storm hits or ends
  solarMultiplier: number; // 1.0 in clear sky, 0.55 in Class I, 0.35 in Class II, 0.15 in Class III
  dustRatePerSol: number; // Structural wear rate
  windSpeedKph: number;
  surfaceTempC: number;
}

export interface TradeContract {
  id: string;
  agency: string;
  title: string;
  description: string;
  resourceRequested: keyof ResourceValues;
  amountRequested: number;
  rewardCredits: number;
  rewardMinerals: number;
  rewardColonists: number;
  rewardTerraformingBoost: number;
  expiresInSols: number;
  totalWindowSols: number;
}

export interface ColonyTelemetry {
  colonyName: string;
  craterName: string;
  sol: number;
  season: 'Northern Spring' | 'Aphelion Winter' | 'Perihelion Dust Season' | 'Southern Summer';
  population: number;
  housingCapacity: number;
  morale: number; // 0 to 100
  selfSufficiency: number; // 0 to 100
  resources: ResourceValues;
  capacities: ResourceValues;
  grossProduction: ResourceValues;
  grossConsumption: ResourceValues;
  netRates: ResourceValues;
  terraforming: TerraformingState;
  activeBuildingsCount: number;
  unpoweredBuildingsCount: number;
  damagedBuildingsCount: number;
  contractsFulfilled: number;
  stormsSurvived: number;
  criticalAlerts: string[];
  lifeSupportGraceTicks: number;
}

export interface RocketEvent {
  id: string;
  tileX: number;
  tileZ: number;
  startTime: number;
  type: 'EXPORT' | 'SUPPLY_DROP';
}

export interface ColonyScenario {
  id: string;
  name: string;
  crater: string;
  difficulty: 'Standard' | 'Rich Aquifers' | 'Extreme Storms';
  description: string;
  startingResources: ResourceValues;
  stormFrequencyMultiplier: number;
  iceRichness: number;
}
