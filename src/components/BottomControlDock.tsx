import React, { useState } from 'react';
import {
  ArrowUpCircle,
  Camera,
  ChevronDown,
  ChevronUp,
  Hammer,
  Pause,
  Play,
  Power,
  RotateCw,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { BUILDING_LIST, BUILDINGS, TERRAIN_INFO } from '../data/buildings';
import {
  BuildingCategory,
  BuildingType,
  CameraPreset,
  ResourceValues,
  TileData,
} from '../types/game';
import { soundEngine } from '../utils/sound';

interface BottomControlDockProps {
  selectedTile: TileData | null;
  selectedBlueprint: BuildingType | null;
  resources: ResourceValues;
  cameraPreset: CameraPreset;
  simSpeed: 0 | 1 | 2;
  onSelectBlueprint: (type: BuildingType | null) => void;
  onBuildOnSelectedTile: (type: BuildingType) => void;
  onUpgradeBuilding: () => void;
  onToggleBuildingPower: () => void;
  onRepairBuilding: () => void;
  onDemolishBuilding: () => void;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  onRotateCamera: () => void;
  onChangeSimSpeed: (speed: 0 | 1 | 2) => void;
  onClearSelection: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  selectedTile,
  selectedBlueprint,
  resources,
  cameraPreset,
  simSpeed,
  onSelectBlueprint,
  onBuildOnSelectedTile,
  onUpgradeBuilding,
  onToggleBuildingPower,
  onRepairBuilding,
  onDemolishBuilding,
  onChangeCameraPreset,
  onRotateCamera,
  onChangeSimSpeed,
  onClearSelection,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [category, setCategory] = useState<BuildingCategory>('ALL');

  const filteredBuildings = BUILDING_LIST.filter(
    (b) => category === 'ALL' || b.category === category
  );

  const activeBuilding = selectedTile?.building
    ? BUILDINGS[selectedTile.building.type]
    : null;

  const upgradeCostMinerals = selectedTile?.building
    ? Math.round(BUILDINGS[selectedTile.building.type].cost.minerals * 0.8 * selectedTile.building.level)
    : 0;
  const upgradeCostCredits = selectedTile?.building
    ? Math.round(BUILDINGS[selectedTile.building.type].cost.credits * 0.8 * selectedTile.building.level)
    : 0;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[95vw] max-w-[960px] pointer-events-none flex flex-col items-center"
      aria-label="Colony Construction and Camera Control Dock"
    >
      {/* Top Bar of Dock: Camera Presets, Sim Speed & Collapsible Zen Mode Toggle */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-t-2xl bg-[#0F141C]/95 border border-b-0 border-[#263244] shadow-lg">
        {/* Camera Angle Switcher */}
        <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
          <Camera className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:inline" />
          {(
            [
              { id: 'ISOMETRIC', label: '3D Iso' },
              { id: 'TOP_DOWN', label: 'Orbital' },
              { id: 'SURFACE', label: 'Surface' },
            ] as { id: CameraPreset; label: string }[]
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeCameraPreset(cam.id);
              }}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                cameraPreset === cam.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onRotateCamera();
            }}
            className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            title="Rotate 3D Camera 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rotate</span>
          </button>
        </div>

        {/* Simulation Speed Controls */}
        <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onChangeSimSpeed(simSpeed === 0 ? 1 : 0);
            }}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              simSpeed === 0
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {simSpeed === 0 ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{simSpeed === 0 ? 'Resume' : 'Pause'}</span>
          </button>
          {([1, 2] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeSimSpeed(spd);
              }}
              className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-mono font-semibold whitespace-nowrap shrink-0 transition-colors ${
                simSpeed === spd
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Collapse / Expand Dock Toggle */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setCollapsed((prev) => !prev);
          }}
          className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Body */}
      {!collapsed && (
        <div className="pointer-events-auto w-full bg-[#0F141C]/95 border border-[#263244] rounded-2xl shadow-2xl p-3 sm:p-4">
          {/* Contextual Selected Tile / Structure Inspector when a tile with a building is clicked */}
          {selectedTile && selectedTile.building && activeBuilding ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-sky-400">
                    Sector ({selectedTile.x}, {selectedTile.z})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{TERRAIN_INFO[selectedTile.terrain].label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-amber-400">
                    Tier {selectedTile.building.level}/3
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      selectedTile.building.powered && selectedTile.building.enabled
                        ? 'text-emerald-400 font-semibold'
                        : 'text-red-400 font-semibold'
                    }
                  >
                    {selectedTile.building.powered && selectedTile.building.enabled
                      ? 'ONLINE'
                      : !selectedTile.building.enabled
                        ? 'STANDBY'
                        : 'NO POWER'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-display font-bold text-white truncate">
                  {activeBuilding.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-1">
                  {activeBuilding.description} · Dust Wear:{' '}
                  <span className="font-mono text-slate-200">
                    {Math.round(selectedTile.building.dustDamage)}%
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Upgrade Tier Button */}
                {selectedTile.building.level < 3 && (
                  <button
                    type="button"
                    disabled={
                      resources.minerals < upgradeCostMinerals ||
                      resources.credits < upgradeCostCredits
                    }
                    onClick={onUpgradeBuilding}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      resources.minerals >= upgradeCostMinerals &&
                      resources.credits >= upgradeCostCredits
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>
                      Upgrade ({upgradeCostMinerals}⛏️ · {upgradeCostCredits}¢)
                    </span>
                  </button>
                )}

                {/* Scrub Dust / Repair Button */}
                {selectedTile.building.dustDamage > 5 && (
                  <button
                    type="button"
                    onClick={onRepairBuilding}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Scrub Dust (15¢)</span>
                  </button>
                )}

                {/* Power Toggle Button */}
                <button
                  type="button"
                  onClick={onToggleBuildingPower}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>{selectedTile.building.enabled ? 'Shut Down' : 'Power On'}</span>
                </button>

                {/* Demolish Button */}
                <button
                  type="button"
                  onClick={onDemolishBuilding}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Salvage</span>
                </button>

                <button
                  type="button"
                  onClick={onClearSelection}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
                >
                  Back to Build
                </button>
              </div>
            </div>
          ) : (
            /* Construction Blueprint Selector using Easy Dropdown Menus */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                {/* 1. Category Filter Dropdown */}
                <div className="sm:col-span-4">
                  <label
                    htmlFor="build-category-select"
                    className="block text-[11px] font-medium text-slate-400 mb-1"
                  >
                    1. System Category
                  </label>
                  <div className="relative">
                    <select
                      id="build-category-select"
                      value={category}
                      onChange={(e) => {
                        soundEngine.playClick();
                        const newCat = e.target.value as BuildingCategory;
                        setCategory(newCat);
                        const matching = BUILDING_LIST.filter(
                          (b) => newCat === 'ALL' || b.category === newCat
                        );
                        if (
                          matching.length > 0 &&
                          (!selectedBlueprint ||
                            (newCat !== 'ALL' &&
                              BUILDINGS[selectedBlueprint].category !== newCat))
                        ) {
                          onSelectBlueprint(matching[0].type);
                        }
                      }}
                      className="w-full min-h-[44px] pl-3 pr-8 py-2 rounded-xl bg-[#131B26] border border-[#2A384E] hover:border-slate-400 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white appearance-none cursor-pointer transition-colors"
                    >
                      <option value="ALL">All Colony Systems (11)</option>
                      <option value="POWER_WATER">Energy & Water Extraction (4)</option>
                      <option value="LIFE_SUPPORT">Oxygen, Habs & Biodomes (3)</option>
                      <option value="INDUSTRY_TERRAFORM">Mining, Terraform & Trade (4)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* 2. Structure Blueprint Dropdown */}
                <div className="sm:col-span-5">
                  <label
                    htmlFor="build-blueprint-select"
                    className="block text-[11px] font-medium text-slate-400 mb-1"
                  >
                    2. Structure Blueprint
                  </label>
                  <div className="relative">
                    <select
                      id="build-blueprint-select"
                      value={selectedBlueprint || ''}
                      onChange={(e) => {
                        soundEngine.playClick();
                        const val = e.target.value as BuildingType | '';
                        onSelectBlueprint(val ? (val as BuildingType) : null);
                      }}
                      className="w-full min-h-[44px] pl-3 pr-8 py-2 rounded-xl bg-[#131B26] border border-amber-500/60 hover:border-amber-400 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white appearance-none cursor-pointer transition-colors"
                    >
                      <option value="">-- None (Inspect Mode Only) --</option>
                      {category === 'ALL' ? (
                        <>
                          <optgroup label="Energy & Water Extraction">
                            {BUILDING_LIST.filter((b) => b.category === 'POWER_WATER').map((b) => (
                              <option key={b.type} value={b.type}>
                                {b.shortName} — {b.cost.minerals}⛏️ {b.cost.credits}¢ (
                                {Object.entries(b.production)
                                  .map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`)
                                  .join(', ')}
                                )
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Oxygen, Habs & Biodomes">
                            {BUILDING_LIST.filter((b) => b.category === 'LIFE_SUPPORT').map((b) => (
                              <option key={b.type} value={b.type}>
                                {b.shortName} — {b.cost.minerals}⛏️ {b.cost.credits}¢ (
                                {Object.entries(b.production)
                                  .map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`)
                                  .join(', ')}
                                )
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Mining, Terraform & Trade">
                            {BUILDING_LIST.filter((b) => b.category === 'INDUSTRY_TERRAFORM').map(
                              (b) => (
                                <option key={b.type} value={b.type}>
                                  {b.shortName} — {b.cost.minerals}⛏️ {b.cost.credits}¢ (
                                  {Object.entries(b.production)
                                    .map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`)
                                    .join(', ') || 'Auto Scrub'}
                                  )
                                </option>
                              )
                            )}
                          </optgroup>
                        </>
                      ) : (
                        filteredBuildings.map((b) => (
                          <option key={b.type} value={b.type}>
                            {b.shortName} — {b.cost.minerals}⛏️ {b.cost.credits}¢ (
                            {Object.entries(b.production)
                              .map(([k, v]) => `+${v} ${k.slice(0, 3).toUpperCase()}`)
                              .join(', ') || 'Auto Scrub'}
                            )
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-amber-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* 3. One-Tap Deploy Button or Tile Status */}
                <div className="sm:col-span-3 flex flex-col justify-end h-full">
                  <span className="hidden sm:block text-[11px] font-medium text-slate-400 mb-1">
                    3. Deployment
                  </span>
                  {selectedBlueprint ? (
                    (() => {
                      const bp = BUILDINGS[selectedBlueprint];
                      const canAfford =
                        resources.minerals >= bp.cost.minerals &&
                        resources.credits >= bp.cost.credits;
                      const validTileSelected =
                        selectedTile &&
                        !selectedTile.building &&
                        bp.allowedTerrains.includes(selectedTile.terrain);

                      if (validTileSelected) {
                        return (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuildOnSelectedTile(bp.type)}
                            className={`w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                              canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Hammer className="w-4 h-4 shrink-0" />
                            <span>
                              {canAfford
                                ? `Build (${bp.cost.minerals}⛏️ · ${bp.cost.credits}¢)`
                                : 'Need Resources'}
                            </span>
                          </button>
                        );
                      }

                      return (
                        <div className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0B0F17] border border-[#1E293B] flex items-center justify-center text-center text-[11px] text-emerald-400 font-medium">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          <span className="truncate">Tap any green 3D tile to build</span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0B0F17] border border-[#1E293B] flex items-center justify-center text-center text-[11px] text-slate-400">
                      <span>Inspect Mode Active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Selected Blueprint Details Strip */}
              {selectedBlueprint && (
                <div className="px-3 py-2 rounded-xl bg-[#0B0F17]/90 border border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="font-semibold text-white">
                      {BUILDINGS[selectedBlueprint].name}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      {BUILDINGS[selectedBlueprint].description}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-[11px] shrink-0">
                    <span
                      className={
                        resources.minerals >= BUILDINGS[selectedBlueprint].cost.minerals &&
                        resources.credits >= BUILDINGS[selectedBlueprint].cost.credits
                          ? 'text-amber-300'
                          : 'text-red-400'
                      }
                    >
                      Cost: {BUILDINGS[selectedBlueprint].cost.minerals}⛏️ ·{' '}
                      {BUILDINGS[selectedBlueprint].cost.credits}¢
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-emerald-400">
                      Output:{' '}
                      {Object.entries(BUILDINGS[selectedBlueprint].production)
                        .map(([k, v]) => `+${v} ${k.toUpperCase()}/sol`)
                        .join(', ') || 'Auto Dust Scrub'}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-sky-300">
                      Terrain:{' '}
                      {BUILDINGS[selectedBlueprint].allowedTerrains
                        .map((t) => t.replace('_', ' '))
                        .join(' / ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
