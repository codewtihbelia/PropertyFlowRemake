import React, { createContext, useContext, useEffect, useState } from 'react';
import { NotificationItem } from '@propertyflow/shared';
import { getAppState, saveAppState, subscribeToStore } from '../services/store';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [state, setState] = useState(getAppState());

  useEffect(() => {
    return subscribeToStore(() => {
      setState(getAppState());
    });
  }, []);

  const userNotifications = state.notifications.filter(
    (n) => n.recipientId === currentUser?.uid || n.recipientId === 'ALL'
  );

  const unreadCount = userNotifications.filter((n) => !n.readStatus).length;

  const markAsRead = (notificationId: string) => {
    const s = getAppState();
    const notif = s.notifications.find((n) => n.notificationId === notificationId);
    if (notif) {
      notif.readStatus = true;
      saveAppState(s);
    }
  };

  const markAllAsRead = () => {
    const s = getAppState();
    s.notifications.forEach((n) => {
      if (n.recipientId === currentUser?.uid || n.recipientId === 'ALL') {
        n.readStatus = true;
      }
    });
    saveAppState(s);
  };

  const clearNotification = (notificationId: string) => {
    const s = getAppState();
    s.notifications = s.notifications.filter((n) => n.notificationId !== notificationId);
    saveAppState(s);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications: userNotifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}

