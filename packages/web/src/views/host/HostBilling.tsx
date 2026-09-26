import React, { useState, useEffect } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { billingService } from "../../services/billingService";
import {
  getAppState,
  saveAppState,
  subscribeToStore,
} from "../../services/store";
import {
  BillingCycle,
  Charge,
  ElectricityConfig,
  formatPesos,
  pesosToCentavos,
  centavosToPesos,
} from "@propertyflow/shared";
import {
  Receipt,
  Zap,
  Droplets,
  Wifi,
  Home,
  Plus,
  CheckCircle2,
  Lock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

export const HostBilling: React.FC = () => {
  const { household, members, billingCycles, activeCycle } = useHousehold();
  const state = getAppState();

  // Re-render immediately when store updates (e.g. mobile adds an expense or charges change)
  const [, setStoreTick] = useState(0);
  useEffect(() => {
    return subscribeToStore(() => setStoreTick((t) => t + 1));
  }, []);

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    activeCycle?.billingCycleId || billingCycles[0]?.billingCycleId || "",
  );

  const currentCycle =
    billingCycles.find((c) => c.billingCycleId === selectedCycleId) ||
    billingCycles[0];

  // Electricity state
  const existingElec = currentCycle
    ? billingService.getElectricityConfig(
        household.householdId,
        currentCycle.billingCycleId,
      )
    : undefined;
  const [prevMeter, setPrevMeter] = useState<number>(
    existingElec?.previousReading || 1250,
  );
  const [currMeter, setCurrMeter] = useState<number>(
    existingElec?.currentReading || 1390,
  );
  const [elecRate, setElecRate] = useState<number>(
    existingElec
      ? centavosToPesos(existingElec.electricityRateCentavosPerKwh)
      : 16.0,
  );

  // Water rate state (Per person/day OR Fixed monthly OR Fixed per person/month)
  const waterConfig = state.waterConfigs[household.householdId] || {
    rateCentavosPerPersonPerDay: 500,
    mode: "BILLING_CYCLE",
    pricingModel: "PER_PERSON_DAY",
    fixedMonthlyAmountCentavos: 0,
    fixedPerPersonAmountCentavos: 0,
  };
  const [waterModel, setWaterModel] = useState<
    "PER_PERSON_DAY" | "FIXED_MONTHLY" | "FIXED_PER_PERSON_MONTH"
  >(
    waterConfig.pricingModel ||
      (waterConfig.fixedMonthlyAmountCentavos
        ? "FIXED_MONTHLY"
        : "PER_PERSON_DAY"),
  );
  const [waterDailyRate, setWaterDailyRate] = useState<number>(
    centavosToPesos(waterConfig.rateCentavosPerPersonPerDay || 500),
  );
  const [fixedWaterAmount, setFixedWaterAmount] = useState<number>(
    centavosToPesos(waterConfig.fixedMonthlyAmountCentavos || 0),
  );
  const [fixedPerPersonWaterAmount, setFixedPerPersonWaterAmount] =
    useState<number>(
      centavosToPesos(waterConfig.fixedPerPersonAmountCentavos || 0),
    );

  // Custom charge form
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeName, setChargeName] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeType, setChargeType] = useState<Charge["chargeType"]>("CUSTOM");
  const [distributionMethod, setDistributionMethod] =
    useState<Charge["distributionMethod"]>("PAYORS_ONLY");

  // New Cycle form
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleName, setNewCycleName] = useState("");
  const [newCycleStart, setNewCycleStart] = useState("2026-07-13");
  const [newCycleEnd, setNewCycleEnd] = useState("2026-08-12");

  // Finalize preview state
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Edit / Delete Cycle state
  const [showEditCycleModal, setShowEditCycleModal] = useState(false);
  const [editCycleName, setEditCycleName] = useState("");
  const [editCycleStart, setEditCycleStart] = useState("");
  const [editCycleEnd, setEditCycleEnd] = useState("");
  const [editCycleStatus, setEditCycleStatus] =
    useState<BillingCycle["status"]>("ACTIVE");
  const [isDeletingCycle, setIsDeletingCycle] = useState(false);

  // Fetch current charges & calculation
  const charges = currentCycle
    ? billingService.getCharges(
        household.householdId,
        currentCycle.billingCycleId,
      )
    : [];

  // Derived Electricity calculation
  const kwhUsed = Math.max(0, currMeter - prevMeter);
  const elecTotalCentavos = pesosToCentavos(kwhUsed * elecRate);

  const handleSaveElectricity = () => {
    if (!currentCycle) return;
    const config: ElectricityConfig = {
      previousReading: prevMeter,
      currentReading: currMeter,
      electricityRateCentavosPerKwh: pesosToCentavos(elecRate),
      consumptionKwh: kwhUsed,
      totalCostCentavos: elecTotalCentavos,
    };
    billingService.saveElectricityConfig(
      household.householdId,
      currentCycle.billingCycleId,
      config,
    );
    alert("Electricity meter configuration saved successfully.");
  };

  const handleSaveWaterRate = () => {
    const config = {
      rateCentavosPerPersonPerDay: pesosToCentavos(waterDailyRate),
      mode: "BILLING_CYCLE" as const,
      pricingModel: waterModel,
      fixedMonthlyAmountCentavos:
        waterModel === "FIXED_MONTHLY" ? pesosToCentavos(fixedWaterAmount) : 0,
      fixedPerPersonAmountCentavos:
        waterModel === "FIXED_PER_PERSON_MONTH"
          ? pesosToCentavos(fixedPerPersonWaterAmount)
          : 0,
    };
    billingService.saveWaterConfig(household.householdId, config);
    alert("Water pricing model and rates saved successfully.");
  };

  const handleAddCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCycle || !chargeName || !chargeAmount) return;

    billingService.addCharge(household.householdId, {
      billingCycleId: currentCycle.billingCycleId,
      householdId: household.householdId,
      chargeType,
      name: chargeName,
      amountCentavos: pesosToCentavos(parseFloat(chargeAmount)),
      distributionMethod: "PAYORS_ONLY",
      participantUserIds: members
        .filter((m) => m.role === "PAYOR")
        .map((m) => m.userId),
      createdBy: state.currentUserId,
    });

    setChargeName("");
    setChargeAmount("");
    setChargeType("CUSTOM");
    setShowAddCharge(false);
  };

  const handleDeleteCharge = async (chargeId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this expense from the cycle?",
      )
    )
      return;
    await billingService.deleteCharge(household.householdId, chargeId);
  };

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    const cycle = billingService.createBillingCycle(household.householdId, {
      householdId: household.householdId,
      name: newCycleName,
      startDate: newCycleStart,
      endDate: newCycleEnd,
      status: "ACTIVE",
      createdBy: state.currentUserId,
    });
    setSelectedCycleId(cycle.billingCycleId);
    setShowNewCycleModal(false);
  };

  const handleOpenEditCycle = () => {
    if (!currentCycle) return;
    setEditCycleName(currentCycle.name);
    setEditCycleStart(currentCycle.startDate);
    setEditCycleEnd(currentCycle.endDate);
    setEditCycleStatus(currentCycle.status);
    setShowEditCycleModal(true);
  };

  const handleUpdateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCycle) return;
    billingService.updateBillingCycle(household.householdId, {
      ...currentCycle,
      name: editCycleName.trim(),
      startDate: editCycleStart,
      endDate: editCycleEnd,
      status: editCycleStatus,
    });
    setShowEditCycleModal(false);
  };

  const handleDeleteCycle = async () => {
    if (!currentCycle) return;
    if (
      !window.confirm(
        `Are you sure you want to delete billing cycle "${currentCycle.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setIsDeletingCycle(true);
    try {
      await billingService.deleteBillingCycle(
        household.householdId,
        currentCycle.billingCycleId,
      );
      const remaining = billingCycles.filter(
        (c) => c.billingCycleId !== currentCycle.billingCycleId,
      );
      if (remaining.length > 0) {
        setSelectedCycleId(remaining[0].billingCycleId);
      } else {
        setSelectedCycleId("");
      }
    } catch (err: any) {
      alert(`Failed to delete cycle: ${err.message}`);
    } finally {
      setIsDeletingCycle(false);
    }
  };

  // Run real-time calculation preview
  const previewCalculation = currentCycle
    ? (() => {
        try {
          return billingService.calculateCurrentBilling(
            household.householdId,
            currentCycle.billingCycleId,
            currentCycle,
          );
        } catch (err) {
          console.warn("[HostBilling] Preview calculation notice:", err);
          return null;
        }
      })()
    : null;

  const handleFinalizeBilling = async () => {
    if (!currentCycle) return;
    setIsFinalizing(true);
    try {
      await billingService.finalizeBillingCycle(
        household.householdId,
        currentCycle.billingCycleId,
      );
      setShowFinalizeModal(false);
      alert(
        "Billing cycle finalized successfully! Roommate bills and notifications have been created.",
      );
    } catch (e: any) {
      alert(`Finalization failed: ${e.message}`);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Cycle Switcher */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-3.5 h-3.5" />
            <span>Cycle & Rate Configuration</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Billing Management Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic centavo-safe splits for rent, utilities, and
            attendance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-blue-600"
          >
            {billingCycles.map((c) => (
              <option key={c.billingCycleId} value={c.billingCycleId}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>

          {currentCycle && (
            <button
              onClick={handleOpenEditCycle}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1"
              title="Edit current cycle"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}

          {currentCycle && (
            <button
              onClick={handleDeleteCycle}
              disabled={isDeletingCycle}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1 border border-rose-200"
              title="Delete current cycle"
            >
              <Trash2 className="w-3.5 h-3.5" />{" "}
              {isDeletingCycle ? "Deleting..." : "Delete"}
            </button>
          )}

          <button
            onClick={() => setShowNewCycleModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Cycle
          </button>

          {currentCycle && currentCycle.status !== "FINALIZED" && (
            <button
              onClick={() => setShowFinalizeModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" /> Finalize Billing
            </button>
          )}

          {currentCycle && currentCycle.status === "FINALIZED" && (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalized & Locked
            </span>
          )}
        </div>
      </div>

      {/* Cycle Period Info Banner */}
      {currentCycle && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-900">
                {currentCycle.name}
              </div>
              <div className="text-[11px] text-blue-700">
                Period: <strong>{currentCycle.startDate}</strong> to{" "}
                <strong>{currentCycle.endDate}</strong>
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-white text-blue-800 font-bold rounded-lg text-xs shadow-2xs border border-blue-100">
            Status: {currentCycle.status}
          </span>
        </div>
      )}

      {/* Core Charges Grid: Rent, Internet, Electricity, Water */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Electricity Meter Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Electricity Sub-Meter Formula
              </h3>
            </div>
            <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {formatPesos(elecTotalCentavos)}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Formula: (Current Reading - Previous Reading) × Rate = kWh Used × ₱
            {elecRate}/kWh
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Previous (kWh)
              </label>
              <input
                type="number"
                value={prevMeter}
                onChange={(e) => setPrevMeter(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Current (kWh)
              </label>
              <input
                type="number"
                value={currMeter}
                onChange={(e) => setCurrMeter(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Rate (₱/kWh)
              </label>
              <input
                type="number"
                step="0.5"
                value={elecRate}
                onChange={(e) => setElecRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Consumption: <strong>{kwhUsed} kWh</strong>
            </span>
            <span className="text-slate-600">
              Split across 4 Payors:{" "}
              <strong>{formatPesos(elecTotalCentavos / 4)}/each</strong>
            </span>
          </div>

          <button
            onClick={handleSaveElectricity}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Save Electricity Meter Reading
          </button>
        </div>

        {/* Water Pricing Configuration Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Water Billing Configuration
                </h3>
                <p className="text-[11px] text-slate-500">
                  Choose between Daily Attendance, Fixed Monthly Total, or Flat
                  Per Person
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {waterModel === "FIXED_PER_PERSON_MONTH"
                ? `₱${fixedPerPersonWaterAmount.toFixed(2)}/resident/month`
                : waterModel === "FIXED_MONTHLY"
                  ? `₱${fixedWaterAmount.toFixed(2)}/month`
                  : `₱${waterDailyRate.toFixed(2)}/person/day`}
            </span>
          </div>

          {/* Pricing Model Selector - 3 Modes */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setWaterModel("PER_PERSON_DAY")}
              className={`py-2 text-[11px] font-bold rounded-xl transition ${
                waterModel === "PER_PERSON_DAY"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ₱/Person/Day
            </button>
            <button
              type="button"
              onClick={() => setWaterModel("FIXED_MONTHLY")}
              className={`py-2 text-[11px] font-bold rounded-xl transition ${
                waterModel === "FIXED_MONTHLY"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fixed Monthly Total
            </button>
            <button
              type="button"
              onClick={() => setWaterModel("FIXED_PER_PERSON_MONTH")}
              className={`py-2 text-[11px] font-bold rounded-xl transition ${
                waterModel === "FIXED_PER_PERSON_MONTH"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fixed/Person/Mo
            </button>
          </div>

          {waterModel === "PER_PERSON_DAY" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Daily Rate (₱ per person per day present)
                </label>
                <input
                  type="number"
                  step="0.50"
                  value={waterDailyRate}
                  onChange={(e) => setWaterDailyRate(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
                />
              </div>

              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-[11px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <Users className="w-3.5 h-3.5" />
                  <span>Fair Payor Distribution Rule</span>
                </div>
                <p>
                  Payors pay their individual attendance days (at ₱
                  {waterDailyRate.toFixed(2)}/day) <strong>plus</strong> the
                  water bill of non-payors split fairly among all payors.
                  Non-payors are exempted from payment.
                </p>
              </div>
            </div>
          ) : waterModel === "FIXED_MONTHLY" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fixed Total Monthly Water Bill (₱)
                </label>
                <input
                  type="number"
                  step="10"
                  value={fixedWaterAmount}
                  onChange={(e) => setFixedWaterAmount(Number(e.target.value))}
                  placeholder="e.g. 1200.00"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
                />
              </div>

              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-[11px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <Users className="w-3.5 h-3.5" />
                  <span>Equal Payor Split Rule</span>
                </div>
                <p>
                  The fixed ₱{fixedWaterAmount.toFixed(2)} water charge is
                  distributed fairly and equally across all Payors. Non-payors
                  are completely exempted.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Flat Fee Per Resident (₱ / resident / month)
                </label>
                <input
                  type="number"
                  step="5"
                  value={fixedPerPersonWaterAmount}
                  onChange={(e) =>
                    setFixedPerPersonWaterAmount(Number(e.target.value))
                  }
                  placeholder="e.g. 150.00"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
                />
              </div>

              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-[11px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <Users className="w-3.5 h-3.5" />
                  <span>Flat Direct Fee Rule</span>
                </div>
                <p>
                  Each paying roommate is charged a flat fee of ₱
                  {fixedPerPersonWaterAmount.toFixed(2)} for water. Attendance
                  logging is disabled.
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveWaterRate}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Save Water Configuration
          </button>
        </div>
      </div>

      {/* Existing Charges & Custom Charges List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Expenses & Configured Charges
            </h3>
            <p className="text-xs text-slate-500">
              Rent, Internet, Electricity, Water, and custom expenses in this
              cycle
            </p>
          </div>

          <button
            onClick={() => setShowAddCharge(true)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl text-xs flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Expense / Charge
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5">Charge Name</th>
                <th className="py-2.5">Category</th>
                <th className="py-2.5">Amount</th>
                <th className="py-2.5">Split Rule</th>
                <th className="py-2.5">Audience</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {charges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No charges or expenses added to this billing cycle yet.
                    Click "Add Expense / Charge" above.
                  </td>
                </tr>
              ) : (
                charges.map((c) => (
                  <tr
                    key={c.chargeId}
                    className="hover:bg-slate-50/60 transition"
                  >
                    <td className="py-3 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded-md text-[10px]">
                        {c.chargeType}
                      </span>
                    </td>
                    <td className="py-3 font-extrabold text-slate-900">
                      {formatPesos(c.amountCentavos)}
                    </td>
                    <td className="py-3 text-slate-600">Fair Payor Split</td>
                    <td className="py-3 text-slate-500 text-[11px]">
                      Payors Only (Non-payors exempt)
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteCharge(c.chargeId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-Finalization Calculation Summary & Member Breakdown */}
      {previewCalculation && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-400 font-bold">
                Grand Calculation Preview
              </span>
              <h3 className="text-xl font-black text-white mt-0.5">
                Household Total Billing
              </h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-400">
                {formatPesos(previewCalculation.grandTotalCentavos)}
              </div>
              <div className="text-[11px] text-slate-400">
                Exact Centavo-Safe Sum
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 text-[10px]">Rent Total</div>
              <div className="text-sm font-bold text-white mt-1">
                {formatPesos(previewCalculation.rentTotalCentavos)}
              </div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 text-[10px]">Internet Total</div>
              <div className="text-sm font-bold text-white mt-1">
                {formatPesos(previewCalculation.internetTotalCentavos)}
              </div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 text-[10px]">
                Electricity Total
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {formatPesos(previewCalculation.electricityTotalCentavos)}
              </div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl">
              <div className="text-slate-400 text-[10px]">Water Total</div>
              <div className="text-sm font-bold text-white mt-1">
                {formatPesos(previewCalculation.waterTotalCentavos)}
              </div>
            </div>
          </div>

          {/* Member-by-Member Detailed Breakdown */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">
                Roommate Bills Breakdown
              </span>
              <span className="text-[11px] text-slate-400">
                Non-payors are exempted (₱0.00). Payors cover expenses +
                non-payor water.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-2">Roommate</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Rent</th>
                    <th className="py-2">Internet</th>
                    <th className="py-2">Electricity</th>
                    <th className="py-2">Water</th>
                    <th className="py-2 text-right">Total Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {previewCalculation.memberBills.map((b) => {
                    const isNonPayor = b.userRole === "NON_PAYOR";
                    return (
                      <tr
                        key={b.userId}
                        className="hover:bg-slate-800/40 transition"
                      >
                        <td className="py-2.5 font-bold text-white">
                          {b.userName}
                        </td>
                        <td className="py-2.5">
                          {isNonPayor ? (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 font-bold rounded-md text-[10px]">
                              NON-PAYOR (EXEMPT)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 font-bold rounded-md text-[10px]">
                              PAYOR
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {isNonPayor ? "—" : formatPesos(b.rentCentavos)}
                        </td>
                        <td className="py-2.5">
                          {isNonPayor ? "—" : formatPesos(b.internetCentavos)}
                        </td>
                        <td className="py-2.5">
                          {isNonPayor
                            ? "—"
                            : formatPesos(b.electricityCentavos)}
                        </td>
                        <td className="py-2.5">
                          {isNonPayor ? (
                            <span className="text-slate-500">
                              Exempt (0.00)
                            </span>
                          ) : (
                            <span>{formatPesos(b.waterCentavos)}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-black text-sm">
                          {isNonPayor ? (
                            <span className="text-slate-500">₱0.00</span>
                          ) : (
                            <span className="text-blue-400">
                              {formatPesos(b.totalDueCentavos)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && previewCalculation && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Billing Finalization</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">
              Finalize {currentCycle?.name}?
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Finalization commits the financial calculations to immutable
              member bills, locks water attendance, and broadcasts billing
              notifications to all roommates.
            </p>

            <div className="mt-4 bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-blue-600">
                  {formatPesos(previewCalculation.grandTotalCentavos)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Members Billed:</span>
                <span>{previewCalculation.memberBills.length} residents</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Water Attendance:</span>
                <span className="text-rose-600 font-semibold">
                  Will be locked from edits
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizeBilling}
                disabled={isFinalizing}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
              >
                {isFinalizing ? "Finalizing..." : "Confirm & Finalize Billing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Charge Modal */}
      {showAddCharge && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Add Household Expense
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Expenses are distributed fairly across all Payors; Non-payors are
              exempted.
            </p>
            <form onSubmit={handleAddCharge} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. July Apartment Rent, PLDT Fiber, Meralco"
                  value={chargeName}
                  onChange={(e) => setChargeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (₱ Pesos)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 15000.00"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={chargeType}
                  onChange={(e) =>
                    setChargeType(e.target.value as Charge["chargeType"])
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-medium"
                >
                  <option value="RENT">Rent (Fair split among Payors)</option>
                  <option value="ELECTRICITY">
                    Electricity (Fair split among Payors)
                  </option>
                  <option value="INTERNET">
                    Internet (Fair split among Payors)
                  </option>
                  <option value="WATER">Water (Fair split among Payors)</option>
                  <option value="CUSTOM">
                    Custom / Misc Expense (Fair split among Payors)
                  </option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800">
                  Split Rule Notice:
                </span>
                <p>
                  Distributed equally among{" "}
                  {members.filter((m) => m.role === "PAYOR").length} Payors.
                  Non-payors are exempted from payment.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCharge(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Cycle Modal */}
      {showNewCycleModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Create New Billing Cycle
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configurable exact start and end dates
            </p>
            <form onSubmit={handleCreateCycle} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cycle Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sep 13 – Oct 12, 2026 Cycle"
                  value={newCycleName}
                  onChange={(e) => setNewCycleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newCycleStart}
                    onChange={(e) => setNewCycleStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newCycleEnd}
                    onChange={(e) => setNewCycleEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCycleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Create Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cycle Modal */}
      {showEditCycleModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Edit Billing Cycle
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Update cycle title, period, and status
            </p>
            <form onSubmit={handleUpdateCycle} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cycle Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cycle name"
                  value={editCycleName}
                  onChange={(e) => setEditCycleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editCycleStart}
                    onChange={(e) => setEditCycleStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editCycleEnd}
                    onChange={(e) => setEditCycleEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editCycleStatus}
                  onChange={(e) =>
                    setEditCycleStatus(e.target.value as BillingCycle["status"])
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-medium"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="FINALIZED">FINALIZED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditCycleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
