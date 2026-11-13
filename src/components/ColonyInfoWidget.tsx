import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Coins,
  Droplets,
  Flame,
  Pickaxe,
  Sprout,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { ColonyTelemetry, WeatherState } from '../types/game';
import { soundEngine } from '../utils/sound';

interface ColonyInfoWidgetProps {
  telemetry: ColonyTelemetry;
  weather: WeatherState;
}

export const ColonyInfoWidget: React.FC<ColonyInfoWidgetProps> = ({
  telemetry,
  weather,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  const stabilityState =
    telemetry.criticalAlerts.length > 0
      ? { label: 'CRITICAL', color: 'text-red-400' }
      : telemetry.netRates.oxygen < 0 ||
          telemetry.netRates.water < 0 ||
          telemetry.netRates.energy < 0
        ? { label: 'STRAINED', color: 'text-amber-400' }
        : { label: 'OPTIMAL', color: 'text-emerald-400' };

  const formatDelta = (val: number) => {
    const rounded = Math.round(val);
    return rounded >= 0 ? `+${rounded}/sol` : `${rounded}/sol`;
  };

  const resourceRows = [
    {
      key: 'oxygen',
      label: 'Oxygen (O₂)',
      icon: <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      current: Math.round(telemetry.resources.oxygen),
      cap: telemetry.capacities.oxygen,
      prod: Math.round(telemetry.grossProduction.oxygen),
      cons: Math.round(telemetry.grossConsumption.oxygen),
      net: telemetry.netRates.oxygen,
    },
    {
      key: 'water',
      label: 'Water (H₂O)',
      icon: <Droplets className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
      current: Math.round(telemetry.resources.water),
      cap: telemetry.capacities.water,
      prod: Math.round(telemetry.grossProduction.water),
      cons: Math.round(telemetry.grossConsumption.water),
      net: telemetry.netRates.water,
    },
    {
      key: 'energy',
      label: 'Energy (kW)',
      icon: <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      current: Math.round(telemetry.resources.energy),
      cap: telemetry.capacities.energy,
      prod: Math.round(telemetry.grossProduction.energy),
      cons: Math.round(telemetry.grossConsumption.energy),
      net: telemetry.netRates.energy,
    },
    {
      key: 'minerals',
      label: 'Minerals',
      icon: <Pickaxe className="w-3.5 h-3.5 text-orange-400 shrink-0" />,
      current: Math.round(telemetry.resources.minerals),
      cap: telemetry.capacities.minerals,
      prod: Math.round(telemetry.grossProduction.minerals),
      cons: Math.round(telemetry.grossConsumption.minerals),
      net: telemetry.netRates.minerals,
    },
    {
      key: 'food',
      label: 'Biomass Food',
      icon: <Sprout className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      current: Math.round(telemetry.resources.food),
      cap: telemetry.capacities.food,
      prod: Math.round(telemetry.grossProduction.food),
      cons: Math.round(telemetry.grossConsumption.food),
      net: telemetry.netRates.food,
    },
    {
      key: 'credits',
      label: 'Colony Credits',
      icon: <Coins className="w-3.5 h-3.5 text-yellow-400 shrink-0" />,
      current: Math.round(telemetry.resources.credits),
      cap: telemetry.capacities.credits,
      prod: Math.round(telemetry.grossProduction.credits),
      cons: Math.round(telemetry.grossConsumption.credits),
      net: telemetry.netRates.credits,
    },
  ];

  return (
    <aside
      aria-label="Colony Information Widget"
      className="pointer-events-auto w-full max-w-[330px] sm:max-w-[356px] bg-[#0F141C]/95 border border-[#263244] rounded-2xl shadow-xl text-slate-100 overflow-hidden transition-transform duration-150"
    >
      {/* Widget Header: Strictly Colony Identification & Toggle */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#1E293B]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-semibold text-slate-200 truncate">
              Colony Information
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              Sol {telemetry.sol}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-mono font-semibold ${stabilityState.color}`}>
              {stabilityState.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {telemetry.colonyName} · {telemetry.season}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setExpanded((prev) => !prev);
          }}
          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
          aria-expanded={expanded}
          title={expanded ? 'Collapse Colony Info' : 'Expand Colony Info'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Compact Summary Bar when collapsed */}
      {!expanded && (
        <div className="grid grid-cols-4 gap-2 px-3.5 py-2 text-[11px] font-mono tabular-nums bg-[#0B0F17]/90">
          <div>
            <span className="text-slate-400 block text-[10px]">O₂</span>
            <span className={telemetry.netRates.oxygen >= 0 ? 'text-sky-300' : 'text-red-400'}>
              {Math.round(telemetry.resources.oxygen)} ({formatDelta(telemetry.netRates.oxygen)})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">H₂O</span>
            <span className={telemetry.netRates.water >= 0 ? 'text-blue-300' : 'text-red-400'}>
              {Math.round(telemetry.resources.water)} ({formatDelta(telemetry.netRates.water)})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Energy</span>
            <span className={telemetry.netRates.energy >= 0 ? 'text-amber-300' : 'text-red-400'}>
              {Math.round(telemetry.resources.energy)} ({formatDelta(telemetry.netRates.energy)})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Terraform</span>
            <span className="text-emerald-300 font-semibold">
              {telemetry.terraforming.totalIndex.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Expanded Dedicated Colony Information Body */}
      {expanded && (
        <div className="p-3.5 space-y-3 text-xs max-h-[58vh] overflow-y-auto">
          {/* Section 1: Demographics & Settlement Vitals */}
          <div className="grid grid-cols-3 gap-2 pb-2.5 border-b border-[#1E293B]">
            <div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-400" />
                <span>Population</span>
              </div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white mt-0.5">
                {telemetry.population} / {telemetry.housingCapacity}
              </div>
              <div className="text-[10px] text-slate-400">
                Morale {Math.round(telemetry.morale)}%
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Self-Sufficiency</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-emerald-400 mt-0.5">
                {Math.round(telemetry.selfSufficiency)}%
              </div>
              <div className="text-[10px] text-slate-400">
                {telemetry.activeBuildingsCount} Online · {telemetry.unpoweredBuildingsCount} Offline
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Atmosphere</span>
              </div>
              <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                {weather.surfaceTempC}°C
              </div>
              <div className="text-[10px] text-slate-400">
                Solar {Math.round(weather.solarMultiplier * 100)}% · {weather.windSpeedKph} kph
              </div>
            </div>
          </div>

          {/* Section 2: Resource Stockpile & Net Rates Ledger */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span>Colony Resource Balance</span>
              <span className="font-mono">Stock / Cap · Net/Sol</span>
            </div>
            <div className="space-y-1.5">
              {resourceRows.map((row) => {
                const fillPct = Math.min(100, Math.round((row.current / Math.max(1, row.cap)) * 100));
                return (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/60 last:border-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {row.icon}
                      <span className="text-slate-200 truncate">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-2.5 font-mono tabular-nums text-[11px] shrink-0">
                      <span className="text-slate-300">
                        {row.current}/{row.cap}{' '}
                        <span className="text-slate-500">({fillPct}%)</span>
                      </span>
                      <span
                        className={`w-16 text-right font-medium ${
                          row.net > 0
                            ? 'text-emerald-400'
                            : row.net < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {formatDelta(row.net)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Terraforming Index Breakdown */}
          <div className="pt-2 border-t border-[#1E293B]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-300 font-medium">
                Terraforming Index (Goal: 100%)
              </span>
              <span className="font-mono tabular-nums text-xs font-bold text-emerald-400">
                {telemetry.terraforming.totalIndex.toFixed(1)}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, telemetry.terraforming.totalIndex)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
              <div>
                <span className="text-slate-400 block text-[10px]">O₂ Pressure</span>
                <span className="text-sky-300 font-medium">
                  {telemetry.terraforming.atmosphere.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Hydration</span>
                <span className="text-blue-300 font-medium">
                  {telemetry.terraforming.hydrosphere.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Biomass</span>
                <span className="text-emerald-300 font-medium">
                  {telemetry.terraforming.biosphere.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Weather & Colony Alerts Readout */}
          <div className="pt-2 border-t border-[#1E293B] text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Weather:{' '}
              <strong
                className={
                  weather.status === 'ACTIVE_STORM'
                    ? 'text-red-400'
                    : weather.status === 'STORM_WARNING'
                      ? 'text-amber-400'
                      : 'text-slate-200'
                }
              >
                {weather.stormName}
              </strong>
            </span>
            <span className="font-mono tabular-nums">
              Trades: {telemetry.contractsFulfilled} · Storms: {telemetry.stormsSurvived}
            </span>
          </div>

          {telemetry.criticalAlerts.length > 0 && (
            <div className="pt-1.5 text-[11px] text-red-300 font-medium">
              Alert: {telemetry.criticalAlerts.join(' · ')}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
