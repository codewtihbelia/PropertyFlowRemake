import { Announcement, Conversation, Message } from '@propertyflow/shared';
import { getAppState, saveAppState } from './store';

export const communicationService = {
  getConversations(householdId: string, userId: string): Conversation[] {
    const state = getAppState();
    return state.conversations.filter(
      (c) => c.householdId === householdId && (c.type === 'HOUSEHOLD_GROUP' || c.participantIds.includes(userId))
    );
  },

  getMessages(conversationId: string): Message[] {
    const state = getAppState();
    return state.messages[conversationId] || [];
  },

  sendMessage(conversationId: string, content: string): Message {
    const state = getAppState();
    const user = state.users[state.currentUserId];

    const newMsg: Message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      householdId: state.currentHouseholdId,
      senderId: user.uid,
      senderName: user.displayName,
      content,
      timestamp: new Date().toISOString(),
      readBy: [user.uid],
    };

    if (!state.messages[conversationId]) state.messages[conversationId] = [];
    state.messages[conversationId].push(newMsg);

    // Update conversation lastMessage
    const conv = state.conversations.find((c) => c.conversationId === conversationId);
    if (conv) {
      conv.lastMessage = content;
      conv.lastMessageTimestamp = newMsg.timestamp;
      conv.updatedAt = newMsg.timestamp;
    }

    saveAppState(state);
    return newMsg;
  },

  getAnnouncements(householdId: string): Announcement[] {
    const state = getAppState();
    return state.announcements[householdId] || [];
  },

  createAnnouncement(
    householdId: string,
    title: string,
    message: string,
    audience: 'EVERYONE' | 'PAYORS' | 'NON_PAYORS' | 'SELECTED_MEMBERS',
    selectedMemberIds?: string[]
  ): Announcement {
    const state = getAppState();
    const user = state.users[state.currentUserId];

    const newAnn: Announcement = {
      announcementId: `ann_${Date.now()}`,
      householdId,
      title,
      message,
      audience,
      selectedMemberIds,
      createdBy: user.uid,
      creatorName: user.displayName,
      createdDate: new Date().toISOString(),
      status: 'ACTIVE',
    };

    if (!state.announcements[householdId]) state.announcements[householdId] = [];
    state.announcements[householdId].unshift(newAnn);

    // Send notifications to audience
    const members = state.members[householdId] || [];
    const targetMembers = members.filter((m) => {
      if (audience === 'EVERYONE') return true;
      if (audience === 'PAYORS') return m.role === 'PAYOR';
      if (audience === 'NON_PAYORS') return m.role === 'NON_PAYOR';
      if (audience === 'SELECTED_MEMBERS') return selectedMemberIds?.includes(m.userId);
      return false;
    });

    for (const tm of targetMembers) {
      if (tm.userId !== user.uid) {
        state.notifications.unshift({
          notificationId: `notif_ann_${Date.now()}_${tm.userId}`,
          recipientId: tm.userId,
          householdId,
          type: 'ANNOUNCEMENT',
          title: `Announcement: ${title}`,
          message,
          relatedEntityId: newAnn.announcementId,
          readStatus: false,
          createdTimestamp: new Date().toISOString(),
        });
      }
    }

    saveAppState(state);
    return newAnn;
  },
};

