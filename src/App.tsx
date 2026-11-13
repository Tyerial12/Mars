import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CloudLightning,
  Play,
  Rocket,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BottomControlDock } from './components/BottomControlDock';
import { ColonyInfoWidget } from './components/ColonyInfoWidget';
import { EarthTradeDrawer } from './components/EarthTradeDrawer';
import { MarsViewport3D } from './components/MarsViewport3D';
import { BUILDINGS, SCENARIOS } from './data/buildings';
import {
  BuildingInstance,
  BuildingType,
  CameraPreset,
  ColonyScenario,
  ColonyTelemetry,
  GameState,
  ResourceValues,
  RocketEvent,
  TerraformingState,
  TerrainType,
  TileData,
  TradeContract,
  WeatherState,
} from './types/game';
import { soundEngine } from './utils/sound';

const STORAGE_KEY = 'red_horizon_mars_colony_save_v1';
const GRID_SIZE = 10;

// Deterministic initial 10x10 Martian crater map generator
function createInitialGrid(scenario: ColonyScenario): TileData[][] {
  const grid: TileData[][] = [];
  for (let z = 0; z < GRID_SIZE; z++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const distCenter = Math.hypot(x - 4.5, z - 4.5);
      let elevation = 1;
      let terrain: TerrainType = 'REGOLITH';

      if (distCenter < 2.2) {
        elevation = 0;
        terrain = 'CRATER_BASIN';
      } else if (distCenter > 5.1) {
        elevation = 2;
        terrain = 'RIDGE';
      }

      // Seed Subsurface Ice Veins & Ore Deposits
      const hash = (x * 37 + z * 17 + scenario.id.charCodeAt(0)) % 19;
      if ((x === 2 && z === 4) || (x === 6 && z === 3) || (hash < 3 && scenario.iceRichness >= 1)) {
        terrain = 'ICE_VEIN';
        elevation = 0;
      } else if ((x === 3 && z === 7) || (x === 7 && z === 6) || hash === 14 || hash === 15) {
        terrain = 'ORE_DEPOSIT';
        elevation = 2;
      }

      let building: BuildingInstance | null = null;
      // Starting Colony Seed Buildings in the center so the 3D colony is alive immediately
      if (x === 4 && z === 4) {
        building = {
          id: 'init-hab',
          type: 'HAB_DOME',
          level: 1,
          powered: true,
          enabled: true,
          dustDamage: 0,
          constructedSol: 1,
        };
      } else if (x === 5 && z === 4) {
        building = {
          id: 'init-solar',
          type: 'SOLAR_ARRAY',
          level: 1,
          powered: true,
          enabled: true,
          dustDamage: 0,
          constructedSol: 1,
        };
      } else if (x === 2 && z === 4) {
        building = {
          id: 'init-water',
          type: 'WATER_EXTRACTOR',
          level: 1,
          powered: true,
          enabled: true,
          dustDamage: 0,
          constructedSol: 1,
        };
      } else if (x === 4 && z === 5) {
        building = {
          id: 'init-o2',
          type: 'OXYGEN_PLANT',
          level: 1,
          powered: true,
          enabled: true,
          dustDamage: 0,
          constructedSol: 1,
        };
      } else if (x === 5 && z === 5) {
        building = {
          id: 'init-pad',
          type: 'LAUNCHPAD',
          level: 1,
          powered: true,
          enabled: true,
          dustDamage: 0,
          constructedSol: 1,
        };
      }

      row.push({
        x,
        z,
        elevation,
        terrain,
        building,
        moisture: terrain === 'ICE_VEIN' ? 60 : 15,
      });
    }
    grid.push(row);
  }
  return grid;
}

function createInitialContracts(sol: number): TradeContract[] {
  return [
    {
      id: `contract-${sol}-1`,
      agency: 'UN Ares Directorate',
      title: 'Cislunar Station Water Resupply',
      description: 'Orbital propellant depot requests purified Martian subsurface water for hydrolox thrusters.',
      resourceRequested: 'water',
      amountRequested: 65,
      rewardCredits: 135,
      rewardMinerals: 30,
      rewardColonists: 4,
      rewardTerraformingBoost: 1.8,
      expiresInSols: 14,
      totalWindowSols: 14,
    },
    {
      id: `contract-${sol}-2`,
      agency: 'Tharsis Orbital Logistics',
      title: 'Pressurized O₂ Reserve Shipment',
      description: 'Deep-space survey fleet requires breathable oxygen canisters before Jupiter transit.',
      resourceRequested: 'oxygen',
      amountRequested: 60,
      rewardCredits: 150,
      rewardMinerals: 40,
      rewardColonists: 3,
      rewardTerraformingBoost: 2.2,
      expiresInSols: 18,
      totalWindowSols: 18,
    },
  ];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedScenario, setSelectedScenario] = useState<ColonyScenario>(SCENARIOS[0]);
  const [grid, setGrid] = useState<TileData[][]>(() => createInitialGrid(SCENARIOS[0]));
  const [sol, setSol] = useState<number>(1);
  const [population, setPopulation] = useState<number>(14);
  const [morale, setMorale] = useState<number>(88);
  const [resources, setResources] = useState<ResourceValues>(SCENARIOS[0].startingResources);
  const [terraforming, setTerraforming] = useState<TerraformingState>({
    atmosphere: 6.5,
    hydrosphere: 8.0,
    biosphere: 4.5,
    totalIndex: 6.3,
  });

  const [weather, setWeather] = useState<WeatherState>({
    status: 'CLEAR',
    stormTier: 0,
    stormName: 'Clear Martian Sky',
    countdownSols: 9,
    solarMultiplier: 1.0,
    dustRatePerSol: 0.4,
    windSpeedKph: 18,
    surfaceTempC: -52,
  });

  const [contracts, setContracts] = useState<TradeContract[]>(() => createInitialContracts(1));
  const [contractsFulfilled, setContractsFulfilled] = useState<number>(0);
  const [stormsSurvived, setStormsSurvived] = useState<number>(0);
  const [lifeSupportGraceTicks, setLifeSupportGraceTicks] = useState<number>(0);

  // Interaction & UI state
  const [selectedTileCoords, setSelectedTileCoords] = useState<{ x: number; z: number } | null>(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState<BuildingType | null>('SOLAR_ARRAY');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('ISOMETRIC');
  const [rotateTrigger, setRotateTrigger] = useState<number>(0);
  const [simSpeed, setSimSpeed] = useState<0 | 1 | 2>(1);
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [rocketEvents, setRocketEvents] = useState<RocketEvent[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Load saved colony on mount if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.grid && parsed.resources && parsed.terraforming) {
          setGrid(parsed.grid);
          setSol(parsed.sol || 1);
          setPopulation(parsed.population || 14);
          setMorale(parsed.morale || 88);
          setResources(parsed.resources);
          setTerraforming(parsed.terraforming);
          if (parsed.weather) setWeather(parsed.weather);
          if (parsed.contracts) setContracts(parsed.contracts);
          setContractsFulfilled(parsed.contractsFulfilled || 0);
          setStormsSurvived(parsed.stormsSurvived || 0);
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, []);

  // Save colony state on Sol updates
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          grid,
          sol,
          population,
          morale,
          resources,
          terraforming,
          weather,
          contracts,
          contractsFulfilled,
          stormsSurvived,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    gameState,
    grid,
    sol,
    population,
    morale,
    resources,
    terraforming,
    weather,
    contracts,
    contractsFulfilled,
    stormsSurvived,
  ]);

  // Calculate comprehensive real-time Colony Telemetry for the Colony Information Widget
  const telemetry: ColonyTelemetry = useMemo(() => {
    const capacities: ResourceValues = {
      oxygen: 260,
      water: 260,
      energy: 300,
      minerals: 320,
      food: 240,
      credits: 1200,
    };
    const grossProduction: ResourceValues = {
      oxygen: 0,
      water: 0,
      energy: 0,
      minerals: 0,
      food: 0,
      credits: 8, // Base colony comm stipend
    };
    const grossConsumption: ResourceValues = {
      oxygen: Math.max(2, Math.round(population * 0.45)),
      water: Math.max(2, Math.round(population * 0.4)),
      energy: 0,
      minerals: 0,
      food: Math.max(2, Math.round(population * 0.35)),
      credits: 0,
    };

    let housingCapacity = 8; // Base command lander bunking
    let activeBuildingsCount = 0;
    let unpoweredBuildingsCount = 0;
    let damagedBuildingsCount = 0;

    for (let z = 0; z < grid.length; z++) {
      for (let x = 0; x < grid[z].length; x++) {
        const tile = grid[z][x];
        const b = tile.building;
        if (!b) continue;
        const def = BUILDINGS[b.type];
        const levelMult = 1 + (b.level - 1) * 0.5;
        const dustPenalty = 1 - (b.dustDamage / 100) * 0.55;

        if (def.storageBonus) {
          (Object.keys(def.storageBonus) as (keyof ResourceValues)[]).forEach((k) => {
            capacities[k] += Math.round((def.storageBonus![k] || 0) * levelMult);
          });
        }
        if (def.housingBonus) {
          housingCapacity += Math.round(def.housingBonus * levelMult);
        }
        if (b.dustDamage > 35) {
          damagedBuildingsCount++;
        }

        if (b.enabled && b.powered) {
          activeBuildingsCount++;
          // Terrain & Weather multipliers
          let terrainBonus = 1.0;
          if (b.type === 'WATER_EXTRACTOR' && tile.terrain === 'ICE_VEIN') terrainBonus = 1.5;
          if (b.type === 'ORE_DRILL' && tile.terrain === 'ORE_DEPOSIT') terrainBonus = 1.5;
          if (b.type === 'SOLAR_ARRAY' && tile.terrain === 'RIDGE') terrainBonus = 1.25;

          const solarFactor = def.stormVulnerable ? weather.solarMultiplier : 1.0;
          const totalMult = levelMult * dustPenalty * terrainBonus * solarFactor;

          (Object.keys(def.production) as (keyof ResourceValues)[]).forEach((k) => {
            grossProduction[k] += (def.production[k] || 0) * totalMult;
          });
          (Object.keys(def.consumption) as (keyof ResourceValues)[]).forEach((k) => {
            grossConsumption[k] += (def.consumption[k] || 0) * levelMult;
          });
        } else {
          unpoweredBuildingsCount++;
        }
      }
    }

    const netRates: ResourceValues = {
      oxygen: grossProduction.oxygen - grossConsumption.oxygen,
      water: grossProduction.water - grossConsumption.water,
      energy: grossProduction.energy - grossConsumption.energy,
      minerals: grossProduction.minerals - grossConsumption.minerals,
      food: grossProduction.food - grossConsumption.food,
      credits: grossProduction.credits - grossConsumption.credits,
    };

    const positiveStreams = [
      netRates.oxygen >= 0 ? 1 : 0,
      netRates.water >= 0 ? 1 : 0,
      netRates.energy >= 0 ? 1 : 0,
      netRates.food >= 0 ? 1 : 0,
      netRates.minerals >= 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    const selfSufficiency = Math.min(
      100,
      Math.round(positiveStreams * 16 + terraforming.totalIndex * 0.2)
    );

    const criticalAlerts: string[] = [];
    if (resources.oxygen < 25) criticalAlerts.push('Low O₂ Reserve');
    if (resources.water < 25) criticalAlerts.push('Low Water Reserve');
    if (resources.energy < 20) criticalAlerts.push('Grid Brownout Risk');
    if (weather.status === 'ACTIVE_STORM') {
      criticalAlerts.push(`Class ${weather.stormTier} Dust Storm Active`);
    }

    const seasons: ColonyTelemetry['season'][] = [
      'Northern Spring',
      'Aphelion Winter',
      'Perihelion Dust Season',
      'Southern Summer',
    ];
    const season = seasons[Math.floor((sol / 25) % 4)];

    return {
      colonyName: selectedScenario.name,
      craterName: selectedScenario.crater,
      sol,
      season,
      population,
      housingCapacity,
      morale,
      selfSufficiency,
      resources,
      capacities,
      grossProduction,
      grossConsumption,
      netRates,
      terraforming,
      activeBuildingsCount,
      unpoweredBuildingsCount,
      damagedBuildingsCount,
      contractsFulfilled,
      stormsSurvived,
      criticalAlerts,
      lifeSupportGraceTicks,
    };
  }, [
    grid,
    sol,
    population,
    morale,
    resources,
    terraforming,
    weather,
    selectedScenario,
    contractsFulfilled,
    stormsSurvived,
    lifeSupportGraceTicks,
  ]);

  const launchpadCount = useMemo(() => {
    let count = 0;
    grid.forEach((row) =>
      row.forEach((t) => {
        if (t.building?.type === 'LAUNCHPAD' && t.building.enabled && t.building.powered) {
          count += t.building.level;
        }
      })
    );
    return count;
  }, [grid]);

  // Start a fresh colony with chosen scenario
  const handleStartNewColony = useCallback(
    (scenario: ColonyScenario) => {
      soundEngine.playBuild();
      setSelectedScenario(scenario);
      setGrid(createInitialGrid(scenario));
      setSol(1);
      setPopulation(14);
      setMorale(90);
      setResources({ ...scenario.startingResources });
      setTerraforming({
        atmosphere: 6.5,
        hydrosphere: 8.0,
        biosphere: 4.5,
        totalIndex: 6.3,
      });
      setWeather({
        status: 'CLEAR',
        stormTier: 0,
        stormName: 'Clear Martian Sky',
        countdownSols: 8,
        solarMultiplier: 1.0,
        dustRatePerSol: 0.4,
        windSpeedKph: 18,
        surfaceTempC: -52,
      });
      setContracts(createInitialContracts(1));
      setContractsFulfilled(0);
      setStormsSurvived(0);
      setLifeSupportGraceTicks(0);
      setSelectedTileCoords(null);
      setSimSpeed(1);
      setGameState('PLAYING');
    },
    []
  );

  // Main Simulation Sol Loop
  useEffect(() => {
    if (gameState !== 'PLAYING' || simSpeed === 0) return;

    const intervalMs = simSpeed === 2 ? 1250 : 2500;
    const timer = window.setInterval(() => {
      setSol((prevSol) => prevSol + 1);

      // 1. Weather & Multi-Tier Dust Storm State Machine
      setWeather((prevW) => {
        if (prevW.countdownSols > 1) {
          return { ...prevW, countdownSols: prevW.countdownSols - 1 };
        }

        if (prevW.status === 'CLEAR') {
          // Transition to Storm Warning
          const roll = Math.random() * selectedScenario.stormFrequencyMultiplier;
          const nextTier: 1 | 2 | 3 = roll > 1.05 ? 3 : roll > 0.55 ? 2 : 1;
          const names = {
            1: 'Class I Local Dust Squall',
            2: 'Class II Regional Haze Front',
            3: 'Class III Planet-Encircling Superstorm',
          };
          soundEngine.playStormAlert();
          setStatusBanner(`Meteorological Alert: ${names[nextTier]} approaching in 3 Sols!`);
          return {
            status: 'STORM_WARNING',
            stormTier: nextTier,
            stormName: `${names[nextTier]} (Inbound)`,
            countdownSols: 3,
            solarMultiplier: 0.9,
            dustRatePerSol: 0.8,
            windSpeedKph: 48 + nextTier * 22,
            surfaceTempC: -56,
          };
        } else if (prevW.status === 'STORM_WARNING') {
          // Storm hits!
          const tier = (prevW.stormTier || 1) as 1 | 2 | 3;
          const solarMults = { 1: 0.58, 2: 0.36, 3: 0.16 };
          const durations = { 1: 4, 2: 6, 3: 7 };
          soundEngine.playStormAlert();
          return {
            status: 'ACTIVE_STORM',
            stormTier: tier,
            stormName: prevW.stormName.replace(' (Inbound)', ''),
            countdownSols: durations[tier],
            solarMultiplier: solarMults[tier],
            dustRatePerSol: tier * 3.2,
            windSpeedKph: 85 + tier * 45,
            surfaceTempC: -68 + Math.round(terraforming.totalIndex * 0.3),
          };
        } else {
          // Active Storm clears
          setStormsSurvived((s) => s + 1);
          setStatusBanner('Dust storm has cleared. Photovoltaic arrays returning to nominal output.');
          return {
            status: 'CLEAR',
            stormTier: 0,
            stormName: 'Clear Martian Sky',
            countdownSols: Math.max(5, Math.round(9 / selectedScenario.stormFrequencyMultiplier)),
            solarMultiplier: 1.0,
            dustRatePerSol: 0.3,
            windSpeedKph: 16,
            surfaceTempC: -52 + Math.round(terraforming.totalIndex * 0.45),
          };
        }
      });

      // 2. Update Grid Buildings (Power allocation, Dust accumulation & Drone Hub scrubbing)
      setGrid((prevGrid) => {
        // Count active Maintenance Drone Hubs
        const droneHubs: { x: number; z: number; level: number }[] = [];
        prevGrid.forEach((row) =>
          row.forEach((t) => {
            if (t.building?.type === 'MAINTENANCE_HUB' && t.building.enabled) {
              droneHubs.push({ x: t.x, z: t.z, level: t.building.level });
            }
          })
        );

        const hasEnoughEnergy = resources.energy > 5 || telemetry.netRates.energy >= 0;
        const hasEnoughWater = resources.water > 5 || telemetry.netRates.water >= 0;

        return prevGrid.map((row) =>
          row.map((tile) => {
            if (!tile.building) return tile;
            const b = tile.building;
            const def = BUILDINGS[b.type];

            // Check if covered by any Drone Hub within radius 3.5
            const isProtectedByDrones = droneHubs.some(
              (dh) => Math.hypot(dh.x - tile.x, dh.z - tile.z) <= 3.5
            );

            let newDust = b.dustDamage + weather.dustRatePerSol;
            if (isProtectedByDrones) {
              newDust = Math.max(0, newDust - 4.5);
            }
            newDust = Math.min(90, Math.max(0, newDust));

            // Determine whether building stays powered
            const needsEnergy = (def.consumption.energy || 0) > 0;
            const needsWater = (def.consumption.water || 0) > 0;
            const powered =
              (!needsEnergy || hasEnoughEnergy) && (!needsWater || hasEnoughWater);

            return {
              ...tile,
              building: {
                ...b,
                powered,
                dustDamage: newDust,
              },
            };
          })
        );
      });

      // 3. Apply Resource Deltas & Terraforming Progression
      setResources((prevRes) => {
        const next: ResourceValues = {
          oxygen: Math.min(
            telemetry.capacities.oxygen,
            Math.max(0, prevRes.oxygen + telemetry.netRates.oxygen)
          ),
          water: Math.min(
            telemetry.capacities.water,
            Math.max(0, prevRes.water + telemetry.netRates.water)
          ),
          energy: Math.min(
            telemetry.capacities.energy,
            Math.max(0, prevRes.energy + telemetry.netRates.energy)
          ),
          minerals: Math.min(
            telemetry.capacities.minerals,
            Math.max(0, prevRes.minerals + telemetry.netRates.minerals)
          ),
          food: Math.min(
            telemetry.capacities.food,
            Math.max(0, prevRes.food + telemetry.netRates.food)
          ),
          credits: Math.min(
            telemetry.capacities.credits,
            Math.max(0, prevRes.credits + telemetry.netRates.credits)
          ),
        };
        return next;
      });

      // 4. Advance Terraforming Index from active terraforming structures
      setTerraforming((prevT) => {
        let dAtmo = 0.04;
        let dHydro = 0.04;
        let dBio = 0.02;

        grid.forEach((row) =>
          row.forEach((t) => {
            if (t.building && t.building.enabled && t.building.powered) {
              const def = BUILDINGS[t.building.type];
              if (def.terraformingRate) {
                const mult = 1 + (t.building.level - 1) * 0.5;
                dAtmo += def.terraformingRate.atmosphere * mult;
                dHydro += def.terraformingRate.hydrosphere * mult;
                dBio += def.terraformingRate.biosphere * mult;
              }
            }
          })
        );

        const atmosphere = Math.min(100, prevT.atmosphere + dAtmo);
        const hydrosphere = Math.min(100, prevT.hydrosphere + dHydro);
        const biosphere = Math.min(100, prevT.biosphere + dBio);
        const totalIndex = Number(((atmosphere + hydrosphere + biosphere) / 3).toFixed(1));

        if (totalIndex >= 100 && prevT.totalIndex < 100) {
          soundEngine.playVictory();
          setGameState('VICTORY');
        }

        return { atmosphere, hydrosphere, biosphere, totalIndex };
      });

      // 5. Population & Morale Dynamics + Life Support Failure Check
      setPopulation((prevPop) => {
        if (
          resources.oxygen > 30 &&
          resources.water > 30 &&
          resources.food > 25 &&
          prevPop < telemetry.housingCapacity
        ) {
          return prevPop + 1;
        }
        return prevPop;
      });

      if (resources.oxygen <= 1 || resources.water <= 1) {
        setMorale((m) => Math.max(0, m - 12));
        setLifeSupportGraceTicks((g) => {
          const nextG = g + 1;
          if (nextG >= 5) {
            setGameState('GAME_OVER');
          }
          return nextG;
        });
      } else {
        setMorale((m) => Math.min(100, m + 2));
        setLifeSupportGraceTicks(0);
      }

      // 6. Update Orbital Earth Trade Contracts & Generate New Requests
      setContracts((prevContracts) => {
        const updated = prevContracts
          .map((c) => ({ ...c, expiresInSols: c.expiresInSols - 1 }))
          .filter((c) => c.expiresInSols > 0);

        if (updated.length < 3 && sol % 5 === 0) {
          const pool: Omit<TradeContract, 'id' | 'expiresInSols' | 'totalWindowSols'>[] = [
            {
              agency: 'UN Ares Directorate',
              title: 'Deep-Space O₂ Life-Support Contract',
              description: 'Supply breathable oxygen canisters for the Jovian science flotilla.',
              resourceRequested: 'oxygen',
              amountRequested: 55 + Math.min(90, Math.round(sol * 1.2)),
              rewardCredits: 145,
              rewardMinerals: 35,
              rewardColonists: 3,
              rewardTerraformingBoost: 2.0,
            },
            {
              agency: 'Pacific Terraforming Consortium',
              title: 'Glacial Meltwater Export',
              description: 'Deliver purified Martian water to orbital hydroponic stations.',
              resourceRequested: 'water',
              amountRequested: 60 + Math.min(90, Math.round(sol * 1.1)),
              rewardCredits: 135,
              rewardMinerals: 45,
              rewardColonists: 2,
              rewardTerraformingBoost: 2.4,
            },
            {
              agency: 'Lunar Helium-3 Syndicate',
              title: 'Refined Martian Alloy Shipment',
              description: 'Earth shipyard requests high-grade iron-titanium regolith alloys.',
              resourceRequested: 'minerals',
              amountRequested: 50 + Math.min(80, Math.round(sol)),
              rewardCredits: 190,
              rewardMinerals: 0,
              rewardColonists: 4,
              rewardTerraformingBoost: 1.5,
            },
            {
              agency: 'Orbital Agrarian Guild',
              title: 'Martian Biodome Harvest Request',
              description: 'Supply fresh hydroponic produce to orbital construction crews.',
              resourceRequested: 'food',
              amountRequested: 45 + Math.min(70, Math.round(sol * 0.9)),
              rewardCredits: 155,
              rewardMinerals: 40,
              rewardColonists: 3,
              rewardTerraformingBoost: 2.5,
            },
          ];
          const pick = pool[(sol + updated.length) % pool.length];
          updated.push({
            ...pick,
            id: `contract-${sol}-${Math.random().toString(36).slice(2, 6)}`,
            expiresInSols: 15,
            totalWindowSols: 15,
          });
        }
        return updated;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    gameState,
    simSpeed,
    sol,
    grid,
    resources,
    telemetry,
    weather.dustRatePerSol,
    terraforming.totalIndex,
    selectedScenario.stormFrequencyMultiplier,
  ]);

  // Clear temporary status banner after 5 seconds
  useEffect(() => {
    if (!statusBanner) return;
    const t = window.setTimeout(() => setStatusBanner(null), 5000);
    return () => clearTimeout(t);
  }, [statusBanner]);

  // Keyboard shortcuts (`Enter` / `Space` to start or pause, `Escape` to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'TITLE_MENU' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartNewColony(selectedScenario);
      } else if (gameState === 'PLAYING') {
        if (e.code === 'Space') {
          e.preventDefault();
          soundEngine.playClick();
          setSimSpeed((s) => (s === 0 ? 1 : 0));
        } else if (e.code === 'Escape') {
          setIsTradeDrawerOpen(false);
          setSelectedTileCoords(null);
        } else if (e.code === 'KeyR') {
          setRotateTrigger((r) => r + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedScenario, handleStartNewColony]);

  // Handle clicking/tapping a 3D tile
  const handleSelectTile = useCallback(
    (x: number, z: number) => {
      const tile = grid[z]?.[x];
      if (!tile) return;

      // If tile is empty and player has an active blueprint selected that fits this terrain, build immediately on second tap or direct tap!
      if (!tile.building && selectedBlueprint) {
        const def = BUILDINGS[selectedBlueprint];
        const canAfford =
          resources.minerals >= def.cost.minerals &&
          resources.credits >= def.cost.credits;
        const validTerrain = def.allowedTerrains.includes(tile.terrain);

        if (canAfford && validTerrain) {
          soundEngine.playBuild();
          setResources((prev) => ({
            ...prev,
            minerals: prev.minerals - def.cost.minerals,
            credits: prev.credits - def.cost.credits,
          }));
          setGrid((prev) =>
            prev.map((row, rz) =>
              row.map((cell, cx) =>
                rz === z && cx === x
                  ? {
                      ...cell,
                      building: {
                        id: `b-${Date.now()}-${x}-${z}`,
                        type: selectedBlueprint,
                        level: 1,
                        powered: true,
                        enabled: true,
                        dustDamage: 0,
                        constructedSol: sol,
                      },
                    }
                  : cell
              )
            )
          );
          setSelectedTileCoords({ x, z });
          return;
        } else if (!validTerrain) {
          setStatusBanner(
            `${def.shortName} requires: ${def.allowedTerrains.join(' or ').replace('_', ' ')}`
          );
        } else if (!canAfford) {
          setStatusBanner(`Insufficient Minerals or Credits for ${def.shortName}.`);
        }
      }

      soundEngine.playClick();
      setSelectedTileCoords({ x, z });
    },
    [grid, selectedBlueprint, resources, sol]
  );

  const selectedTileData = useMemo(() => {
    if (!selectedTileCoords) return null;
    return grid[selectedTileCoords.z]?.[selectedTileCoords.x] || null;
  }, [grid, selectedTileCoords]);

  // Construct on currently selected empty tile
  const handleBuildOnSelectedTile = useCallback(
    (type: BuildingType) => {
      if (!selectedTileCoords) return;
      const { x, z } = selectedTileCoords;
      const tile = grid[z]?.[x];
      if (!tile || tile.building) return;
      const def = BUILDINGS[type];
      if (
        resources.minerals < def.cost.minerals ||
        resources.credits < def.cost.credits ||
        !def.allowedTerrains.includes(tile.terrain)
      ) {
        return;
      }

      soundEngine.playBuild();
      setResources((prev) => ({
        ...prev,
        minerals: prev.minerals - def.cost.minerals,
        credits: prev.credits - def.cost.credits,
      }));
      setGrid((prev) =>
        prev.map((row, rz) =>
          row.map((cell, cx) =>
            rz === z && cx === x
              ? {
                  ...cell,
                  building: {
                    id: `b-${Date.now()}-${x}-${z}`,
                    type,
                    level: 1,
                    powered: true,
                    enabled: true,
                    dustDamage: 0,
                    constructedSol: sol,
                  },
                }
              : cell
          )
        )
      );
    },
    [selectedTileCoords, grid, resources, sol]
  );

  const handleUpgradeSelectedBuilding = useCallback(() => {
    if (!selectedTileCoords) return;
    const { x, z } = selectedTileCoords;
    const tile = grid[z]?.[x];
    if (!tile?.building || tile.building.level >= 3) return;

    const def = BUILDINGS[tile.building.type];
    const minCost = Math.round(def.cost.minerals * 0.8 * tile.building.level);
    const credCost = Math.round(def.cost.credits * 0.8 * tile.building.level);
    if (resources.minerals < minCost || resources.credits < credCost) return;

    soundEngine.playUpgrade();
    setResources((prev) => ({
      ...prev,
      minerals: prev.minerals - minCost,
      credits: prev.credits - credCost,
    }));
    setGrid((prev) =>
      prev.map((row, rz) =>
        row.map((cell, cx) =>
          rz === z && cx === x && cell.building
            ? {
                ...cell,
                building: {
                  ...cell.building,
                  level: cell.building.level + 1,
                  dustDamage: 0,
                },
              }
            : cell
        )
      )
    );
  }, [selectedTileCoords, grid, resources]);

  const handleToggleBuildingPower = useCallback(() => {
    if (!selectedTileCoords) return;
    const { x, z } = selectedTileCoords;
    soundEngine.playClick();
    setGrid((prev) =>
      prev.map((row, rz) =>
        row.map((cell, cx) =>
          rz === z && cx === x && cell.building
            ? {
                ...cell,
                building: {
                  ...cell.building,
                  enabled: !cell.building.enabled,
                },
              }
            : cell
        )
      )
    );
  }, [selectedTileCoords]);

  const handleRepairBuilding = useCallback(() => {
    if (!selectedTileCoords || resources.credits < 15) return;
    const { x, z } = selectedTileCoords;
    soundEngine.playUpgrade();
    setResources((prev) => ({ ...prev, credits: prev.credits - 15 }));
    setGrid((prev) =>
      prev.map((row, rz) =>
        row.map((cell, cx) =>
          rz === z && cx === x && cell.building
            ? {
                ...cell,
                building: {
                  ...cell.building,
                  dustDamage: 0,
                },
              }
            : cell
        )
      )
    );
  }, [selectedTileCoords, resources.credits]);

  const handleDemolishBuilding = useCallback(() => {
    if (!selectedTileCoords) return;
    const { x, z } = selectedTileCoords;
    const tile = grid[z]?.[x];
    if (!tile?.building) return;
    const def = BUILDINGS[tile.building.type];

    soundEngine.playDemolish();
    setResources((prev) => ({
      ...prev,
      minerals: Math.min(
        telemetry.capacities.minerals,
        prev.minerals + Math.round(def.cost.minerals * 0.5)
      ),
    }));
    setGrid((prev) =>
      prev.map((row, rz) =>
        row.map((cell, cx) => (rz === z && cx === x ? { ...cell, building: null } : cell))
      )
    );
  }, [selectedTileCoords, grid, telemetry.capacities.minerals]);

  // Trigger a 3D Orbital Cargo Rocket animation on a Launchpad (or colony center)
  const triggerRocketLaunch = useCallback(
    (type: 'EXPORT' | 'SUPPLY_DROP') => {
      let padCoords = { x: 5, z: 5 };
      grid.forEach((row) =>
        row.forEach((t) => {
          if (t.building?.type === 'LAUNCHPAD') {
            padCoords = { x: t.x, z: t.z };
          }
        })
      );
      setRocketEvents((prev) => [
        ...prev.slice(-4),
        {
          id: `rocket-${Date.now()}-${Math.random()}`,
          tileX: padCoords.x,
          tileZ: padCoords.z,
          startTime: performance.now(),
          type,
        },
      ]);
    },
    [grid]
  );

  // Fulfill an Earth Trade Contract
  const handleFulfillContract = useCallback(
    (contractId: string) => {
      const contract = contracts.find((c) => c.id === contractId);
      if (!contract) return;
      const available = resources[contract.resourceRequested] || 0;
      if (available < contract.amountRequested) return;

      const bonusMult = 1 + launchpadCount * 0.25;
      const earnedCredits = Math.round(contract.rewardCredits * bonusMult);
      const earnedMinerals = Math.round(contract.rewardMinerals * bonusMult);

      soundEngine.playTradeComplete();
      triggerRocketLaunch('EXPORT');

      setResources((prev) => ({
        ...prev,
        [contract.resourceRequested]: prev[contract.resourceRequested] - contract.amountRequested,
        credits: Math.min(telemetry.capacities.credits, prev.credits + earnedCredits),
        minerals: Math.min(telemetry.capacities.minerals, prev.minerals + earnedMinerals),
      }));

      if (contract.rewardColonists > 0) {
        setPopulation((p) => Math.min(telemetry.housingCapacity, p + contract.rewardColonists));
      }

      if (contract.rewardTerraformingBoost > 0) {
        setTerraforming((prevT) => {
          const boost = contract.rewardTerraformingBoost;
          const atmosphere = Math.min(100, prevT.atmosphere + boost);
          const hydrosphere = Math.min(100, prevT.hydrosphere + boost);
          const biosphere = Math.min(100, prevT.biosphere + boost);
          const totalIndex = Number(((atmosphere + hydrosphere + biosphere) / 3).toFixed(1));
          if (totalIndex >= 100 && prevT.totalIndex < 100) {
            soundEngine.playVictory();
            setGameState('VICTORY');
          }
          return { atmosphere, hydrosphere, biosphere, totalIndex };
        });
      }

      setContracts((prev) => prev.filter((c) => c.id !== contractId));
      setContractsFulfilled((c) => c + 1);
      setStatusBanner(`Orbital Cargo Launched to ${contract.agency}! +${earnedCredits} Credits.`);
    },
    [
      contracts,
      resources,
      launchpadCount,
      telemetry.capacities.credits,
      telemetry.capacities.minerals,
      telemetry.housingCapacity,
      triggerRocketLaunch,
    ]
  );

  // Emergency Earth Supply Drop
  const handleEmergencyImport = useCallback(
    (resource: keyof ResourceValues, amount: number, costCredits: number) => {
      if (resources.credits < costCredits) return;
      soundEngine.playTradeComplete();
      triggerRocketLaunch('SUPPLY_DROP');
      setResources((prev) => ({
        ...prev,
        credits: prev.credits - costCredits,
        [resource]: Math.min(telemetry.capacities[resource], prev[resource] + amount),
      }));
      setStatusBanner(`Emergency Orbital Supply Pod landed: +${amount} ${resource.toUpperCase()}`);
    },
    [resources.credits, telemetry.capacities, triggerRocketLaunch]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B0F17] select-none">
      {/* 1. Full-Viewport 3D Three.js WebGL Martian Colony Scene */}
      <MarsViewport3D
        grid={grid}
        selectedTile={selectedTileCoords}
        selectedBlueprint={selectedBlueprint}
        cameraPreset={cameraPreset}
        rotateTrigger={rotateTrigger}
        weather={weather}
        terraformingIndex={terraforming.totalIndex}
        rocketEvents={rocketEvents}
        isTitleScreen={gameState === 'TITLE_MENU'}
        onSelectTile={handleSelectTile}
      />

      {/* 2. TITLE SCREEN OVERLAY (Full-Viewport Game Shell) */}
      {gameState === 'TITLE_MENU' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-gradient-to-t from-[#0B0F17]/95 via-[#0B0F17]/65 to-transparent">
          <div className="w-full max-w-xl bg-[#0F141C]/95 border border-[#263244] rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            {/* Bespoke Inline SVG Title Lockup */}
            <div className="flex flex-col items-center">
              <svg
                className="w-16 h-16 mb-3"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="40" cy="40" r="34" fill="#7C2D12" stroke="#F59E0B" strokeWidth="2.5" />
                <path
                  d="M16 48C26 42 54 42 64 48"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M24 38C24 29.1634 31.1634 22 40 22C48.8366 22 56 29.1634 56 38H24Z"
                  fill="#0EA5E9"
                  fillOpacity="0.45"
                  stroke="#E0F2FE"
                  strokeWidth="2"
                />
                <circle cx="56" cy="22" r="4" fill="#10B981" />
              </svg>

              <span className="text-xs font-mono tracking-widest text-amber-400">
                3D MARTIAN TERRAFORMING SIMULATION
              </span>
              <h1
                className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight mt-1"
                style={{ textWrap: 'balance' }}
              >
                Red Horizon: Mars Colony Architect
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mt-2">
                Construct a 3D pressurized settlement, balance subsurface water extraction,
                electrolysis oxygen, and solar/RTG energy grids, survive multi-tier dust storms,
                and fulfill orbital Earth cargo contracts to reach 100% Terraforming.
              </p>
            </div>

            {/* Crater Scenario Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
              {SCENARIOS.map((scen) => {
                const isSelected = selectedScenario.id === scen.id;
                return (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedScenario(scen);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#192434] border-amber-400 shadow-md'
                        : 'bg-[#131B26] border-[#243042] hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-bold text-white truncate">{scen.name}</div>
                    <div className="text-[11px] font-mono text-amber-400 mt-0.5">
                      {scen.difficulty}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {scen.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Primary Start CTA */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleStartNewColony(selectedScenario)}
                className="w-full min-h-[50px] py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Colony Mission</span>
              </button>

              {/* Single Flat Control-Hint Line */}
              <p className="text-[11px] font-mono text-slate-400">
                1-Finger Drag Orbit · 2-Finger Pan/Pinch Zoom · Tap 3D Tile Build/Inspect · Space Pause
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACTIVE GAMEPLAY LOW-OCCLUSION PERIMETER HUD */}
      {gameState !== 'TITLE_MENU' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
          {/* Top Row: Left = Dedicated Colony Information Widget | Right = Orbital Trade & Utility Actions */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-2.5">
            {/* Dedicated Widget ONLY showing Information on Colony */}
            <ColonyInfoWidget telemetry={telemetry} weather={weather} />

            {/* Top-Right Compact Action Cluster (Earth Trade, Weather Alert, Audio Mute & Reset) */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-end sm:self-start">
              {/* Active Dust Storm Banner */}
              {weather.status !== 'CLEAR' && (
                <div
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                    weather.status === 'ACTIVE_STORM'
                      ? 'bg-[#2C1215]/95 border-red-500/60 text-red-200'
                      : 'bg-[#291D12]/95 border-amber-500/60 text-amber-200'
                  }`}
                >
                  <CloudLightning className="w-4 h-4 shrink-0 text-amber-400" />
                  <div className="font-mono tabular-nums">
                    <span className="font-semibold block leading-tight">
                      {weather.stormName}
                    </span>
                    <span className="text-[10px] opacity-85">
                      {weather.status === 'ACTIVE_STORM'
                        ? `Solar ${Math.round(weather.solarMultiplier * 100)}% · Clears in ${weather.countdownSols} Sols`
                        : `Impact in ${weather.countdownSols} Sols`}
                    </span>
                  </div>
                </div>
              )}

              {/* Orbital Earth Trade Contracts Button */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setIsTradeDrawerOpen(true);
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0F141C]/95 hover:bg-[#192330] border border-[#263244] text-slate-100 text-xs font-semibold flex items-center gap-2 shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Rocket className="w-4 h-4 text-amber-400" />
                <span>Earth Trade ({contracts.length})</span>
              </button>

              {/* Audio Mute Toggle */}
              <button
                type="button"
                onClick={() => {
                  const muted = soundEngine.toggleMute();
                  setIsMuted(muted);
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0F141C]/95 hover:bg-[#192330] border border-[#263244] text-slate-300 hover:text-white flex items-center justify-center shadow-lg transition-colors cursor-pointer"
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Return to Mission Select / Reset */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameState('TITLE_MENU');
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0F141C]/95 hover:bg-[#192330] border border-[#263244] text-slate-300 hover:text-white flex items-center justify-center shadow-lg transition-colors cursor-pointer"
                aria-label="Mission Select Menu"
                title="Mission Select Menu"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transient Notification Toast */}
          {statusBanner && (
            <div className="self-center pointer-events-auto px-4 py-2 rounded-xl bg-[#0F141C]/95 border border-amber-500/50 text-amber-200 text-xs font-medium shadow-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          {/* Spacer for Bottom Control Dock */}
          <div className="h-24" />
        </div>
      )}

      {/* 4. UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK */}
      {gameState === 'PLAYING' && (
        <BottomControlDock
          selectedTile={selectedTileData}
          selectedBlueprint={selectedBlueprint}
          resources={resources}
          cameraPreset={cameraPreset}
          simSpeed={simSpeed}
          onSelectBlueprint={setSelectedBlueprint}
          onBuildOnSelectedTile={handleBuildOnSelectedTile}
          onUpgradeBuilding={handleUpgradeSelectedBuilding}
          onToggleBuildingPower={handleToggleBuildingPower}
          onRepairBuilding={handleRepairBuilding}
          onDemolishBuilding={handleDemolishBuilding}
          onChangeCameraPreset={setCameraPreset}
          onRotateCamera={() => setRotateTrigger((r) => r + 1)}
          onChangeSimSpeed={setSimSpeed}
          onClearSelection={() => setSelectedTileCoords(null)}
        />
      )}

      {/* 5. EARTH ORBITAL TRADE & SUPPLY DRAWER */}
      <EarthTradeDrawer
        isOpen={isTradeDrawerOpen}
        contracts={contracts}
        resources={resources}
        launchpadCount={launchpadCount}
        onClose={() => setIsTradeDrawerOpen(false)}
        onFulfillContract={handleFulfillContract}
        onEmergencyImport={handleEmergencyImport}
      />

      {/* 6. VICTORY OR COLONY FAILURE MODAL */}
      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#0F141C] border border-[#263244] rounded-3xl p-6 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-slate-800/80">
              {gameState === 'VICTORY' ? (
                <Trophy className="w-8 h-8 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-400" />
              )}
            </div>

            <div>
              <h2 className="text-2xl font-display font-bold text-white">
                {gameState === 'VICTORY'
                  ? 'Mars Terraforming Complete!'
                  : 'Colony Life-Support Depleted'}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                {gameState === 'VICTORY'
                  ? `After ${sol} Martian Sols, ${selectedScenario.name} achieved a 100% self-sustaining atmosphere, liquid aquifers, and thriving biosphere.`
                  : `Critical oxygen or water reserves remained at zero for too long in ${selectedScenario.name}. Tip: Build backup Battery Banks and Subsurface Ice Extractors before Class III dust storms hit.`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#141C27] border border-[#1E293B] font-mono tabular-nums text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Sols Elapsed</span>
                <span className="text-white font-bold text-sm">{sol}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Population</span>
                <span className="text-sky-400 font-bold text-sm">{population}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Earth Trades</span>
                <span className="text-emerald-400 font-bold text-sm">{contractsFulfilled}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {gameState === 'VICTORY' && (
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Continue Sandbox
                </button>
              )}
              <button
                type="button"
                onClick={() => handleStartNewColony(selectedScenario)}
                className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
