import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHousehold } from "../../contexts/HouseholdContext";
import { attendanceService } from "../../services/attendanceService";
import { getAppState } from "../../services/store";
import {
  WaterAttendanceStatus,
  formatPesos,
  centavosToPesos,
} from "@propertyflow/shared";
import { Droplets, Check, X, Minus, Lock, Calendar } from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const ClientAttendance: React.FC = () => {
  const { currentUser } = useAuth();
  const { household, activeCycle, loading } = useHousehold();
  const state = getAppState();

  const currentCycle =
    activeCycle || state.billingCycles[household.householdId]?.[0];
  const waterConfig = state.waterConfigs[household.householdId] || {
    rateCentavosPerPersonPerDay: 500,
    mode: "BILLING_CYCLE",
  };

  if (loading && currentUser.householdId) {
    return <UniversalLoader variant="skeleton" type="attendance" />;
  }

  if (!currentCycle) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center text-slate-500 max-w-2xl mx-auto">
        No active billing cycle configured for water attendance.
      </div>
    );
  }

  // Dates strictly from start to end
  const dates: string[] = [];
  const start = new Date(currentCycle.startDate);
  const end = new Date(currentCycle.endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const attendanceRecords = attendanceService.getUserAttendance(
    household.householdId,
    currentCycle.billingCycleId,
    currentUser.uid,
  );

  const getStatus = (dateStr: string): WaterAttendanceStatus => {
    const rec = attendanceRecords.find((a) => a.date === dateStr);
    return rec ? rec.status : "UNMARKED";
  };

  const isLocked = currentCycle.status === "FINALIZED";

  const handleToggle = (dateStr: string) => {
    if (isLocked) {
      alert(
        "Attendance is locked for this finalized billing cycle. Contact your Host to request corrections.",
      );
      return;
    }

    const current = getStatus(dateStr);
    let next: WaterAttendanceStatus = "PRESENT";
    if (current === "PRESENT") next = "ABSENT";
    else if (current === "ABSENT") next = "UNMARKED";
    else next = "PRESENT";

    attendanceService.updateAttendance(
      household.householdId,
      currentCycle.billingCycleId,
      currentUser.uid,
      dateStr,
      next,
    );
  };

  const presentDays = attendanceRecords.filter(
    (a) => a.status === "PRESENT",
  ).length;
  const absentDays = attendanceRecords.filter(
    (a) => a.status === "ABSENT",
  ).length;
  const waterCostCentavos =
    presentDays * waterConfig.rateCentavosPerPersonPerDay;

  const isFixedMode =
    waterConfig.pricingModel === "FIXED_MONTHLY" ||
    waterConfig.pricingModel === "FIXED_PER_PERSON_MONTH";

  const payorCount = Math.max(
    1,
    (state.members[household.householdId] || []).filter(
      (m) => m.role === "PAYOR",
    ).length,
  );
  const myFixedShareCentavos =
    waterConfig.pricingModel === "FIXED_MONTHLY"
      ? Math.round((waterConfig.fixedMonthlyAmountCentavos || 0) / payorCount)
      : waterConfig.fixedPerPersonAmountCentavos || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Droplets className="w-3.5 h-3.5" />
            <span>Water Attendance</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Water Logging & Status
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentCycle.name} ({currentCycle.startDate} to{" "}
            {currentCycle.endDate})
          </p>
        </div>

        {isLocked ? (
          <span className="px-3.5 py-1.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-rose-200">
            <Lock className="w-4 h-4" /> Locked & Finalized
          </span>
        ) : (
          <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-emerald-200">
            <Check className="w-4 h-4" /> Open for cycle
          </span>
        )}
      </div>

      {isFixedMode ? (
        /* Informational Notice Card for Fixed Modes */
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-black text-slate-900">
              Daily attendance is not required for your apartment.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {waterConfig.pricingModel === "FIXED_MONTHLY"
                ? `Household water bill (${formatPesos(waterConfig.fixedMonthlyAmountCentavos || 0)}) is split evenly across ${payorCount} paying roommates.`
                : `Water is billed as a flat monthly rate of ${formatPesos(waterConfig.fixedPerPersonAmountCentavos || 0)} / resident.`}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700">
            <span>🛡️ Configured by Property Host</span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 max-w-lg mx-auto">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Mode
              </div>
              <div className="text-sm font-black text-slate-900 mt-1">
                {waterConfig.pricingModel === "FIXED_MONTHLY"
                  ? "Equal Split"
                  : "Flat Rate"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Your Share
              </div>
              <div className="text-sm font-black text-blue-600 mt-1">
                {formatPesos(myFixedShareCentavos)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                Calendar
              </div>
              <div className="text-sm font-black text-emerald-600 mt-1">
                Exempt
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards for PER_PERSON_DAY */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <div className="text-xs font-semibold text-slate-500">
                Days Present
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {presentDays}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <div className="text-xs font-semibold text-slate-500">
                Days Absent
              </div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {absentDays}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
              <div className="text-xs font-semibold text-slate-500">
                My Water Share
              </div>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {formatPesos(waterCostCentavos)}
              </div>
            </div>
          </div>

          {/* Interactive Calendar Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Tap any day to toggle Present / Absent
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />{" "}
                  Present
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />{" "}
                  Absent
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-md bg-slate-100 border inline-block" />{" "}
                  Unmarked
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 pt-2">
              {dates.map((d) => {
                const st = getStatus(d);
                const dateObj = new Date(d);
                const dayName = dateObj.toLocaleDateString([], {
                  weekday: "short",
                });
                const dayNum = d.slice(8);

                return (
                  <button
                    key={d}
                    onClick={() => handleToggle(d)}
                    disabled={isLocked}
                    className={`p-3 rounded-2xl text-center border transition flex flex-col items-center justify-center gap-1 ${
                      st === "PRESENT"
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-xs"
                        : st === "ABSENT"
                          ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    } ${isLocked ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase ${st !== "UNMARKED" ? "text-white/80" : "text-slate-400"}`}
                    >
                      {dayName}
                    </span>
                    <span className="text-base font-black">{dayNum}</span>
                    <span className="text-[10px] font-bold">
                      {st === "PRESENT"
                        ? "Present"
                        : st === "ABSENT"
                          ? "Absent"
                          : "Unmarked"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
