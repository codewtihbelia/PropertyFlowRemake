import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { attendanceService } from "../../services/attendanceService";
import { getAppState } from "../../services/store";
import {
  WaterAttendanceStatus,
  formatPesos,
  centavosToPesos,
} from "@propertyflow/shared";
import {
  Droplets,
  Check,
  X,
  Minus,
  Lock,
  Unlock,
  Calendar,
} from "lucide-react";

export const HostAttendance: React.FC = () => {
  const { household, members, activeCycle } = useHousehold();
  const state = getAppState();

  const currentCycle =
    activeCycle || state.billingCycles[household.householdId]?.[0];
  const waterConfig = state.waterConfigs[household.householdId] || {
    rateCentavosPerPersonPerDay: 500,
    mode: "BILLING_CYCLE",
  };

  const [filterRole, setFilterRole] = useState<"ALL" | "PAYORS">("ALL");

  if (!currentCycle) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center text-slate-500">
        No active billing cycle configured for attendance.
      </div>
    );
  }

  // Generate date array strictly from cycle startDate to endDate
  const dates: string[] = [];
  const start = new Date(currentCycle.startDate);
  const end = new Date(currentCycle.endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const attendanceRecords = attendanceService.getAttendanceForCycle(
    household.householdId,
    currentCycle.billingCycleId,
  );

  const displayedMembers = members.filter((m) => {
    if (m.status !== "ACTIVE") return false;
    if (filterRole === "PAYORS") return m.role === "PAYOR";
    return true;
  });

  const getStatus = (
    userId: string,
    dateStr: string,
    memberId?: string,
  ): WaterAttendanceStatus => {
    const rawId = userId.replace("mem_", "");
    const rec = attendanceRecords.find(
      (a) =>
        (a.userId === userId ||
          (memberId && a.userId === memberId) ||
          a.userId === rawId ||
          a.userId === `mem_${rawId}`) &&
        a.date === dateStr,
    );
    return rec ? rec.status : "UNMARKED";
  };

  const handleToggle = (userId: string, dateStr: string, memberId?: string) => {
    const effectiveId = userId || memberId || "";
    const current = getStatus(userId, dateStr, memberId);
    let next: WaterAttendanceStatus = "PRESENT";
    if (current === "PRESENT") next = "ABSENT";
    else if (current === "ABSENT") next = "UNMARKED";
    else next = "PRESENT";

    attendanceService.updateAttendance(
      household.householdId,
      currentCycle.billingCycleId,
      effectiveId,
      dateStr,
      next,
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <Droplets className="w-3.5 h-3.5" />
            <span>Attendance Master Matrix</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Water Attendance Calendar
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict cycle period: <strong>{currentCycle.startDate}</strong> to{" "}
            <strong>{currentCycle.endDate}</strong> ({dates.length} days) ·
            Rate:{" "}
            <strong>
              ₱{centavosToPesos(waterConfig.rateCentavosPerPersonPerDay)}
              /person/day
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setFilterRole(filterRole === "ALL" ? "PAYORS" : "ALL")
            }
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            Filter: {filterRole === "ALL" ? "All Members" : "Payors Only"}
          </button>
          {currentCycle.status === "FINALIZED" ? (
            <span className="px-3 py-1.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1 border border-rose-200">
              <Lock className="w-3.5 h-3.5" /> Locked (Finalized)
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1 border border-emerald-200">
              <Unlock className="w-3.5 h-3.5" /> Open for edits
            </span>
          )}
        </div>
      </div>

      {/* Attendance Grid Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                ✕
              </span>
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-md bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                -
              </span>
              <span>Unmarked</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Click any box to cycle status
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="py-3 px-2 text-left font-bold w-44 sticky left-0 bg-white z-10">
                  Roommate
                </th>
                <th className="py-3 px-2 text-center font-bold">
                  Days Present
                </th>
                <th className="py-3 px-2 text-center font-bold">Water Share</th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className="py-3 px-1 text-center font-semibold min-w-8"
                  >
                    <div className="text-[10px] text-slate-400">
                      {new Date(d).toLocaleDateString([], {
                        weekday: "narrow",
                      })}
                    </div>
                    <div>{d.slice(8)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMembers.map((m) => {
                const rawId = (m.userId || "").replace("mem_", "");
                const memberRecords = attendanceRecords.filter(
                  (a) =>
                    a.userId === m.userId ||
                    (m.memberId && a.userId === m.memberId) ||
                    a.userId === rawId ||
                    a.userId === `mem_${rawId}`,
                );
                const presentCount = memberRecords.filter(
                  (a) => a.status === "PRESENT",
                ).length;
                const waterCostCentavos =
                  presentCount * waterConfig.rateCentavosPerPersonPerDay;

                return (
                  <tr
                    key={m.memberId || m.userId}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-2 font-bold text-slate-900 sticky left-0 bg-white z-10 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                        {m.displayName.charAt(0)}
                      </div>
                      <span className="truncate max-w-32">{m.displayName}</span>
                    </td>
                    <td className="py-3 px-2 text-center font-extrabold text-blue-600 bg-blue-50/40">
                      {presentCount} d
                    </td>
                    <td className="py-3 px-2 text-center font-black text-slate-900 bg-blue-50/40">
                      {formatPesos(waterCostCentavos)}
                    </td>
                    {dates.map((d) => {
                      const st = getStatus(m.userId, d, m.memberId);
                      return (
                        <td key={d} className="py-2 px-1 text-center">
                          <button
                            onClick={() =>
                              handleToggle(m.userId, d, m.memberId)
                            }
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold transition flex items-center justify-center mx-auto shadow-2xs ${
                              st === "PRESENT"
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : st === "ABSENT"
                                  ? "bg-rose-500 text-white hover:bg-rose-600"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {st === "PRESENT"
                              ? "✓"
                              : st === "ABSENT"
                                ? "✕"
                                : "-"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
