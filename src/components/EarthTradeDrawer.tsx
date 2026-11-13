import React from 'react';
import {
  ArrowUpRight,
  Clock,
  PackageCheck,
  Rocket,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ResourceValues, TradeContract } from '../types/game';
import { soundEngine } from '../utils/sound';

interface EarthTradeDrawerProps {
  isOpen: boolean;
  contracts: TradeContract[];
  resources: ResourceValues;
  launchpadCount: number;
  onClose: () => void;
  onFulfillContract: (contractId: string) => void;
  onEmergencyImport: (resource: keyof ResourceValues, amount: number, costCredits: number) => void;
}

const RESOURCE_LABELS: Record<keyof ResourceValues, string> = {
  oxygen: 'Oxygen (O₂)',
  water: 'Purified Water (H₂O)',
  energy: 'Energy Cells (kW)',
  minerals: 'Refined Minerals',
  food: 'Biomass Rations',
  credits: 'Credits',
};

export const EarthTradeDrawer: React.FC<EarthTradeDrawerProps> = ({
  isOpen,
  contracts,
  resources,
  launchpadCount,
  onClose,
  onFulfillContract,
  onEmergencyImport,
}) => {
  if (!isOpen) return null;

  const bonusPct = launchpadCount * 25;

  const emergencySupplies: Array<{
    resource: keyof ResourceValues;
    label: string;
    amount: number;
    cost: number;
  }> = [
    { resource: 'oxygen', label: 'Emergency O₂ Tank Drop', amount: 85, cost: 90 },
    { resource: 'water', label: 'Orbital Ice Pod Drop', amount: 90, cost: 85 },
    { resource: 'energy', label: 'Charged Fuel Cell Drop', amount: 110, cost: 95 },
    { resource: 'minerals', label: 'Titanium Alloy Drop', amount: 75, cost: 100 },
    { resource: 'food', label: 'Hydroponic Ration Drop', amount: 80, cost: 80 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Earth Orbital Trade and Supply Center"
    >
      <div className="w-full max-w-2xl bg-[#0F141C] border border-[#263244] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2 text-slate-100 font-display font-bold text-lg">
              <Rocket className="w-5 h-5 text-amber-400" />
              <h2>Earth Orbital Trade & Cargo Requests</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Launchpads Active: <span className="font-mono text-slate-200">{launchpadCount}</span> · Contract Payout Bonus: <span className="font-mono text-emerald-400">+{bonusPct}%</span> · Credits Available: <span className="font-mono text-yellow-400">{Math.round(resources.credits)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close Earth Trade Window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Active Trade Requests from Earth */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Active Earth Cargo Requests ({contracts.length})
              </h3>
              <span className="text-xs text-slate-400">
                New orbital windows open every few Sols
              </span>
            </div>

            {contracts.length === 0 ? (
              <div className="p-6 text-center border border-[#1E293B] rounded-xl bg-[#0B0F17]">
                <p className="text-sm text-slate-300 font-medium">
                  All current orbital cargo manifests completed.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Deep-space telemetry is tracking the next Earth transfer vessel.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.map((c) => {
                  const currentStock = resources[c.resourceRequested] || 0;
                  const canAfford = currentStock >= c.amountRequested;
                  const mult = 1 + launchpadCount * 0.25;
                  const finalCredits = Math.round(c.rewardCredits * mult);
                  const finalMinerals = Math.round(c.rewardMinerals * mult);

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-[#141C27] border border-[#263244] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-amber-300 font-medium">{c.agency}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1 font-mono tabular-nums text-slate-300">
                            <Clock className="w-3 h-3 text-sky-400" />
                            Window: {c.expiresInSols} Sols left
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white">{c.title}</h4>
                        <p className="text-xs text-slate-400">{c.description}</p>
                        <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
                          <span className={canAfford ? 'text-sky-300' : 'text-red-400'}>
                            Export: {c.amountRequested} {RESOURCE_LABELS[c.resourceRequested]} (Have {Math.floor(currentStock)})
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-emerald-400">
                            Reward: +{finalCredits} Credits
                            {finalMinerals > 0 ? ` · +${finalMinerals} Minerals` : ''}
                            {c.rewardColonists > 0 ? ` · +${c.rewardColonists} Colonists` : ''}
                            {c.rewardTerraformingBoost > 0
                              ? ` · +${c.rewardTerraformingBoost.toFixed(1)}% Terraform`
                              : ''}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onFulfillContract(c.id)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Launch Cargo</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Emergency Earth Supply Drops */}
          <section className="pt-4 border-t border-[#1E293B]">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Emergency Earth Supply Drops (Instant Orbital Pod)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {emergencySupplies.map((item) => {
                const canBuy = resources.credits >= item.cost;
                return (
                  <div
                    key={item.resource}
                    className="p-3 rounded-xl bg-[#141C27] border border-[#263244] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                        +{item.amount} {item.resource.toUpperCase()} · Cost: {item.cost} Credits
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() =>
                        onEmergencyImport(item.resource, item.amount, item.cost)
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                        canBuy
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Import</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
