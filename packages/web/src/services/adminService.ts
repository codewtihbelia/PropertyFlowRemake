import { AppVersion, AuditLog, Household, SupportTicket, UserProfile } from '@propertyflow/shared';
import { getAppState, saveAppState } from './store';

export const adminService = {
  getPlatformMetrics() {
    const state = getAppState();
    const households = Object.values(state.households);
    const users = Object.values(state.users);
    const hosts = users.filter((u) => u.role === 'HOST');
    const payors = users.filter((u) => u.role === 'PAYOR');
    const nonPayors = users.filter((u) => u.role === 'NON_PAYOR');
    const activeUsers = users.filter((u) => u.accountStatus === 'ACTIVE');
    const inactiveUsers = users.filter((u) => u.accountStatus !== 'ACTIVE');

    return {
      totalHouseholds: households.length,
      totalHosts: hosts.length,
      totalPayors: payors.length,
      totalNonPayors: nonPayors.length,
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      inactiveUsers: inactiveUsers.length,
      openTickets: state.supportTickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    };
  },

  getAllHouseholds(): Household[] {
    const state = getAppState();
    return Object.values(state.households);
  },

  getAllUsers(): UserProfile[] {
    const state = getAppState();
    return Object.values(state.users);
  },

  setUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    const state = getAppState();
    const user = state.users[userId];
    if (user) {
      user.accountStatus = status;
      state.auditLogs.unshift({
        logId: `log_${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users[state.currentUserId]?.displayName || 'Super Admin',
        role: 'SUPER_ADMIN',
        action: 'USER_STATUS_CHANGE',
        entity: 'user',
        entityId: userId,
        timestamp: new Date().toISOString(),
        newValue: { status },
      });
      saveAppState(state);
    }
  },

  getAppVersions(): AppVersion[] {
    const state = getAppState();
    return state.appVersions;
  },

  updateAppVersion(version: AppVersion) {
    const state = getAppState();
    const idx = state.appVersions.findIndex((v) => v.versionId === version.versionId);
    if (idx >= 0) {
      state.appVersions[idx] = version;
    } else {
      state.appVersions.push(version);
    }
    saveAppState(state);
  },

  getSupportTickets(): SupportTicket[] {
    const state = getAppState();
    return state.supportTickets;
  },

  updateTicketStatus(ticketId: string, status: SupportTicket['status']) {
    const state = getAppState();
    const ticket = state.supportTickets.find((t) => t.ticketId === ticketId);
    if (ticket) {
      ticket.status = status;
      ticket.updatedDate = new Date().toISOString();
      saveAppState(state);
    }
  },

  getAuditLogs(): AuditLog[] {
    const state = getAppState();
    return state.auditLogs;
  },
};

