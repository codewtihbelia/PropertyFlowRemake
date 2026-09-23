import { WaterAttendanceRecord, WaterAttendanceStatus } from '@propertyflow/shared';
import { getAppState, saveAppState } from './store';

export const attendanceService = {
  getAttendanceForCycle(householdId: string, billingCycleId: string): WaterAttendanceRecord[] {
    const state = getAppState();
    return (state.waterAttendance[householdId] || []).filter(
      (a) => a.billingCycleId === billingCycleId
    );
  },

  getUserAttendance(householdId: string, billingCycleId: string, userId: string): WaterAttendanceRecord[] {
    return this.getAttendanceForCycle(householdId, billingCycleId).filter((a) => a.userId === userId);
  },

  updateAttendance(
    householdId: string,
    billingCycleId: string,
    userId: string,
    date: string,
    status: WaterAttendanceStatus
  ): WaterAttendanceRecord {
    const state = getAppState();
    if (!state.waterAttendance[householdId]) state.waterAttendance[householdId] = [];

    const existingIndex = state.waterAttendance[householdId].findIndex(
      (a) => a.billingCycleId === billingCycleId && a.userId === userId && a.date === date
    );

    const caller = state.users[state.currentUserId];
    const isHost = caller?.role === 'HOST';

    if (existingIndex >= 0) {
      const record = state.waterAttendance[householdId][existingIndex];
      if (record.locked && !isHost) {
        throw new Error('Attendance is locked for finalized billing cycle.');
      }
      record.status = status;
      record.modifiedBy = state.currentUserId;
      record.modifiedTimestamp = new Date().toISOString();
      saveAppState(state);
      return record;
    } else {
      const newRecord: WaterAttendanceRecord = {
        recordId: `att_${userId}_${date}_${Date.now()}`,
        householdId,
        billingCycleId,
        userId,
        date,
        status,
        locked: false,
        modifiedBy: state.currentUserId,
        modifiedTimestamp: new Date().toISOString(),
      };
      state.waterAttendance[householdId].push(newRecord);
      saveAppState(state);
      return newRecord;
    }
  },

  bulkUpdateAttendance(
    householdId: string,
    billingCycleId: string,
    userId: string,
    status: WaterAttendanceStatus,
    dates: string[]
  ) {
    const state = getAppState();
    if (!state.waterAttendance[householdId]) state.waterAttendance[householdId] = [];

    for (const date of dates) {
      const existing = state.waterAttendance[householdId].find(
        (a) => a.billingCycleId === billingCycleId && a.userId === userId && a.date === date
      );
      if (existing) {
        if (!existing.locked || state.users[state.currentUserId]?.role === 'HOST') {
          existing.status = status;
          existing.modifiedBy = state.currentUserId;
          existing.modifiedTimestamp = new Date().toISOString();
        }
      } else {
        state.waterAttendance[householdId].push({
          recordId: `att_${userId}_${date}_${Date.now()}`,
          householdId,
          billingCycleId,
          userId,
          date,
          status,
          locked: false,
          modifiedBy: state.currentUserId,
          modifiedTimestamp: new Date().toISOString(),
        });
      }
    }

    saveAppState(state);
  },
};

