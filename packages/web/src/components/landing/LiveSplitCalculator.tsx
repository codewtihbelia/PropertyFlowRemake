import React, { useState, useMemo } from "react";
import {
  Calculator,
  Users,
  Droplets,
  Zap,
  Wifi,
  Home,
  ShoppingBag,
  Check,
  Copy,
  Sparkles,
  RotateCcw,
  ArrowRight,
  TrendingDown,
  Info,
} from "lucide-react";
import { formatPesos } from "@propertyflow/shared";

interface RoommateInput {
  id: string;
  name: string;
  roomName: string;
  daysPresent: number;
  fixedRentPesos?: number;
}

export const LiveSplitCalculator: React.FC = () => {
  // Preset definitions
  const presets = [
    {
      id: "condo3",
      label: "3-Bed City Condo",
      rent: 36000,
      electricity: 5200,
      water: 950,
      internet: 1899,
      supplies: 1200,
      roommates: [
        {
          id: "1",
          name: "Alex Cruz",
          roomName: "Master (En-suite)",
          daysPresent: 30,
          fixedRentPesos: 14000,
        },
        {
          id: "2",
          name: "Sarah Lim",
          roomName: "Bedroom 2",
          daysPresent: 18,
          fixedRentPesos: 11000,
        }, // away 12 days
        {
          id: "3",
          name: "Daniel Tan",
          roomName: "Bedroom 3",
          daysPresent: 30,
          fixedRentPesos: 11000,
        },
      ],
    },
    {
      id: "dorm4",
      label: "4-Person Student Dorm",
      rent: 24000,
      electricity: 3800,
      water: 800,
      internet: 1499,
      supplies: 600,
      roommates: [
        { id: "1", name: "Bea Santos", roomName: "Bed A", daysPresent: 30 },
        { id: "2", name: "Carlos Reyes", roomName: "Bed B", daysPresent: 22 }, // away 8 days
        { id: "3", name: "Marco Diaz", roomName: "Bed C", daysPresent: 30 },
        { id: "4", name: "Patricia Go", roomName: "Bed D", daysPresent: 15 }, // away 15 days
      ],
    },
    {
      id: "duo2",
      label: "2-Person Flat",
      rent: 22000,
      electricity: 3200,
      water: 550,
      internet: 1699,
      supplies: 800,
      roommates: [
        { id: "1", name: "Liam Chen", roomName: "Bedroom 1", daysPresent: 30 },
        { id: "2", name: "Noah Perez", roomName: "Bedroom 2", daysPresent: 25 },
      ],
    },
  ];

  const [activePreset, setActivePreset] = useState("condo3");
  const [rent, setRent] = useState<number>(36000);
  const [electricity, setElectricity] = useState<number>(5200);
  const [water, setWater] = useState<number>(950);
  const [internet, setInternet] = useState<number>(1899);
  const [supplies, setSupplies] = useState<number>(1200);
  const [useEqualRent, setUseEqualRent] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  const [roommates, setRoommates] = useState<RoommateInput[]>([
    {
      id: "1",
      name: "Alex Cruz",
      roomName: "Master (En-suite)",
      daysPresent: 30,
      fixedRentPesos: 14000,
    },
    {
      id: "2",
      name: "Sarah Lim",
      roomName: "Bedroom 2",
      daysPresent: 18,
      fixedRentPesos: 11000,
    },
    {
      id: "3",
      name: "Daniel Tan",
      roomName: "Bedroom 3",
      daysPresent: 30,
      fixedRentPesos: 11000,
    },
  ]);

  const loadPreset = (presetId: string) => {
    const p = presets.find((item) => item.id === presetId);
    if (!p) return;
    setActivePreset(presetId);
    setRent(p.rent);
    setElectricity(p.electricity);
    setWater(p.water);
    setInternet(p.internet);
    setSupplies(p.supplies);
    setRoommates(p.roommates);
    setUseEqualRent(false);
  };

  const handleDaysChange = (id: string, days: number) => {
    setRoommates((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, daysPresent: Math.max(0, Math.min(30, days)) }
          : r,
      ),
    );
  };

  const handleAddRoommate = () => {
    if (roommates.length >= 6) return;
    const newId = String(Date.now());
    setRoommates((prev) => [
      ...prev,
      {
        id: newId,
        name: `Roommate ${prev.length + 1}`,
        roomName: `Bed/Room ${prev.length + 1}`,
        daysPresent: 30,
      },
    ]);
  };

  const handleRemoveRoommate = (id: string) => {
    if (roommates.length <= 2) return;
    setRoommates((prev) => prev.filter((r) => r.id !== id));
  };

  // Perform split calculations with absence redistribution
  const splitResults = useMemo(() => {
    const numMembers = roommates.length;
    if (numMembers === 0) return { totalBill: 0, items: [] };

    // Total expenses in centavos
    const totalRentCents = Math.round(rent * 100);
    const totalElecCents = Math.round(electricity * 100);
    const totalWaterCents = Math.round(water * 100);
    const totalInternetCents = Math.round(internet * 100);
    const totalSuppliesCents = Math.round(supplies * 100);
    const grandTotalCents =
      totalRentCents +
      totalElecCents +
      totalWaterCents +
      totalInternetCents +
      totalSuppliesCents;

    // Fixed Utilities (Internet & Supplies) split equally
    const fixedUtilCentsPerPerson = Math.floor(
      (totalInternetCents + totalSuppliesCents) / numMembers,
    );
    const fixedRemainder =
      (totalInternetCents + totalSuppliesCents) % numMembers;

    // Variable Utilities (Water & Electricity) split based on days present
    const totalPersonDays = roommates.reduce(
      (acc, r) => acc + r.daysPresent,
      0,
    );
    const variablePoolCents = totalElecCents + totalWaterCents;

    // Rent calculation
    let rentCentsMap: Record<string, number> = {};
    if (useEqualRent) {
      const baseRent = Math.floor(totalRentCents / numMembers);
      const rentRemainder = totalRentCents % numMembers;
      roommates.forEach((r, idx) => {
        rentCentsMap[r.id] = baseRent + (idx < rentRemainder ? 1 : 0);
      });
    } else {
      // Use fixed rent if available, or normalize
      const sumDeclared = roommates.reduce(
        (acc, r) => acc + (r.fixedRentPesos || 0),
        0,
      );
      if (sumDeclared > 0) {
        roommates.forEach((r) => {
          const ratio = (r.fixedRentPesos || 0) / sumDeclared;
          rentCentsMap[r.id] = Math.round(totalRentCents * ratio);
        });
      } else {
        const baseRent = Math.floor(totalRentCents / numMembers);
        roommates.forEach((r) => {
          rentCentsMap[r.id] = baseRent;
        });
      }
    }

    // Allocate variable utility shares based on actual attendance
    const items = roommates.map((r, idx) => {
      const fixedShare =
        fixedUtilCentsPerPerson + (idx < fixedRemainder ? 1 : 0);

      let variableShare = 0;
      if (totalPersonDays > 0) {
        variableShare = Math.round(
          (r.daysPresent / totalPersonDays) * variablePoolCents,
        );
      } else {
        variableShare = Math.round(variablePoolCents / numMembers);
      }

      // Normal full-stay benchmark for utility
      const fullStayBenchmark = Math.round(
        (30 / (30 * numMembers)) * variablePoolCents,
      );
      const absenceSavingCents = Math.max(0, fullStayBenchmark - variableShare);

      const rRentCents = rentCentsMap[r.id] || 0;
      const totalDueCents = rRentCents + fixedShare + variableShare;

      return {
        ...r,
        rentCents: rRentCents,
        fixedUtilCents: fixedShare,
        variableUtilCents: variableShare,
        totalDueCents,
        absenceSavingCents,
      };
    });

    return {
      grandTotalCents,
      totalRentCents,
      variablePoolCents,
      items,
    };
  }, [rent, electricity, water, internet, supplies, roommates, useEqualRent]);

  // Copy text summary
  const handleCopySummary = () => {
    const lines = [
      `🏠 PropertyFlow / Splitzy Bill Summary`,
      `Total Invoice: ${formatPesos(splitResults.grandTotalCents)}`,
      `Rent: ₱${rent.toLocaleString()} | Electricity: ₱${electricity.toLocaleString()} | Water: ₱${water.toLocaleString()}`,
      `Internet: ₱${internet.toLocaleString()} | Supplies: ₱${supplies.toLocaleString()}`,
      `----------------------------------------`,
      ...splitResults.items.map(
        (i) =>
          `• ${i.name} (${i.roomName}): ${formatPesos(i.totalDueCents)} [${i.daysPresent}/30 days]` +
          (i.absenceSavingCents > 0
            ? ` (Saved ${formatPesos(i.absenceSavingCents)} via absence)`
            : ""),
      ),
      `----------------------------------------`,
      `Calculated with Splitzy Centavo Precision Engine`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section
      id="calculator"
      className="py-16 md:py-24 bg-slate-50 border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider border border-brand-200">
            <Calculator className="w-3.5 h-3.5 text-brand-600" />
            <span>Interactive Simulator</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            See the Absence & Centavo Engine <br />
            <span className="text-brand-600">In Action Right Now</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Adjust utility bills, toggle days away, and watch how PropertyFlow
            dynamically recalculates each roommate's fair share without rounding
            errors.
          </p>
        </div>

        {/* Preset Selector Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
            Load Preset:
          </span>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => loadPreset(p.id)}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activePreset === p.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Calculator Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Inputs (Bills & Roommates) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Box 1: Household Bills */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Monthly Household Invoices
                    </h3>
                    <p className="text-xs text-slate-500">
                      Enter amounts in Philippine Pesos (₱)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500">
                    Total Invoices:
                  </span>
                  <p className="text-base font-black text-slate-900">
                    {formatPesos(splitResults.grandTotalCents)}
                  </p>
                </div>
              </div>

              {/* 2-Column Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-slate-400" />
                    <span>Total Rent</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      type="number"
                      value={rent}
                      onChange={(e) =>
                        setRent(Math.max(0, Number(e.target.value)))
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Electricity (Power)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      type="number"
                      value={electricity}
                      onChange={(e) =>
                        setElectricity(Math.max(0, Number(e.target.value)))
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    <span>Water (Attendance-Weighted)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      type="number"
                      value={water}
                      onChange={(e) =>
                        setWater(Math.max(0, Number(e.target.value)))
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                    <span>High-Speed WiFi / Internet</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      type="number"
                      value={internet}
                      onChange={(e) =>
                        setInternet(Math.max(0, Number(e.target.value)))
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      Shared Supplies (Water gallons, laundry, essentials)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      type="number"
                      value={supplies}
                      onChange={(e) =>
                        setSupplies(Math.max(0, Number(e.target.value)))
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-brand-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Rent split toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-600">
                  Equal Rent Split for all rooms?
                </span>
                <button
                  type="button"
                  onClick={() => setUseEqualRent(!useEqualRent)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    useEqualRent
                      ? "bg-brand-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {useEqualRent ? "Equal Rent Enabled" : "Custom Room Rates"}
                </button>
              </div>
            </div>

            {/* Box 2: Roommates & Absence Slider */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Roommate Attendance & Stays
                    </h3>
                    <p className="text-xs text-slate-500">
                      Slide to test absence discounts (days present / 30)
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAddRoommate}
                  disabled={roommates.length >= 6}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40"
                >
                  + Add Roommate
                </button>
              </div>

              <div className="space-y-4">
                {roommates.map((r, i) => (
                  <div
                    key={r.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-900">
                          {r.name}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({r.roomName})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            r.daysPresent === 30
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.daysPresent} / 30 days present
                        </span>
                        {roommates.length > 2 && (
                          <button
                            onClick={() => handleRemoveRoommate(r.id)}
                            className="text-slate-400 hover:text-rose-500 text-xs font-bold"
                            title="Remove roommate"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Attendance Range Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>0 days (Away whole month)</span>
                        <span>
                          {30 - r.daysPresent > 0
                            ? `${30 - r.daysPresent} days away on trip`
                            : "Full month stay"}
                        </span>
                        <span>30 days (Full)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={r.daysPresent}
                        onChange={(e) =>
                          handleDaysChange(r.id, Number(e.target.value))
                        }
                        className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Calculated Fair Output & Visual Breakdown */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-xl space-y-6 border border-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                    Computed Output
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Individual Fair Shares
                  </h3>
                </div>
                <button
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-300 border border-slate-700 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copied ? "Copied to Clipboard!" : "Copy Summary"}
                  </span>
                </button>
              </div>

              {/* Roommate Shares Table */}
              <div className="space-y-3">
                {splitResults.items.map((item) => {
                  const percentOfTotal = (
                    (item.totalDueCents / splitResults.grandTotalCents) *
                    100
                  ).toFixed(1);
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2 hover:border-brand-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({item.roomName})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">
                              Stay: {item.daysPresent}/30 days
                            </span>
                            {item.absenceSavingCents > 0 && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                                Saved {formatPesos(item.absenceSavingCents)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black text-brand-400">
                            {formatPesos(item.totalDueCents)}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {percentOfTotal}% of total bill
                          </span>
                        </div>
                      </div>

                      {/* Micro visual breakdown bar */}
                      <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-300">
                        <span>Rent: {formatPesos(item.rentCents)}</span>
                        <span>
                          Utilities:{" "}
                          {formatPesos(
                            item.fixedUtilCents + item.variableUtilCents,
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Verification Callout */}
              <div className="p-3.5 rounded-xl bg-brand-950/60 border border-brand-800/60 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white">
                    Centavo Accuracy Guarantee
                  </p>
                  <p>
                    All values are stored as integers (cents). The sum of all
                    individual splits mathematically equals 100% of the original
                    invoice with zero rounding loss.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
