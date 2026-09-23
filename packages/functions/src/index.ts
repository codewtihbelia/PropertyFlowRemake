import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {
  calculateHouseholdBilling,
  calculateRedistributionPlan,
  createAdjustmentRecord,
  formatPesos,
  BillingCycle,
  HouseholdMember,
  Charge,
  WaterAttendanceRecord,
  ElectricityConfig,
  WaterConfig,
  MemberBill,
  Payment,
} from "@propertyflow/shared";

admin.initializeApp();
const db = admin.firestore();

async function assertHostAccess(
  householdId: string,
  callerUid: string,
  callerEmail?: string,
): Promise<admin.firestore.DocumentSnapshot> {
  const householdDoc = await db.collection("households").doc(householdId).get();
  const household = householdDoc.data();

  if (!householdDoc.exists || !household) {
    throw new functions.https.HttpsError(
      "not-found",
      "Household does not exist.",
    );
  }

  if (household.hostId === callerUid) {
    return householdDoc;
  }

  if (callerEmail && household.hostId) {
    const hostUserDoc = await db
      .collection("users")
      .doc(household.hostId)
      .get();
    const hostEmail = hostUserDoc.data()?.email;
    if (
      typeof hostEmail === "string" &&
      hostEmail.toLowerCase() === callerEmail.toLowerCase()
    ) {
      return householdDoc;
    }
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "Only the household Host can perform this operation.",
  );
}

async function assertSuperAdmin(callerUid?: string) {
  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  const userDoc = await db.collection("users").doc(callerUid).get();
  if (userDoc.data()?.role !== "SUPER_ADMIN") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Super Admins can perform this operation.",
    );
  }

  return userDoc;
}

export const bootstrapSuperAdmin = functions.https.onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const callerEmail = request.auth?.token.email as string | undefined;
  const callerName =
    (request.auth?.token.name as string | undefined) ||
    callerEmail ||
    "Super Admin";
  const providedSecret = request.data?.bootstrapSecret;

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  const existingAdmins = await db
    .collection("users")
    .where("role", "==", "SUPER_ADMIN")
    .limit(1)
    .get();
  const expectedSecret = process.env.SUPER_ADMIN_BOOTSTRAP_SECRET;

  if (!existingAdmins.empty) {
    await assertSuperAdmin(callerUid);
  } else if (expectedSecret && providedSecret !== expectedSecret) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Invalid super admin bootstrap secret.",
    );
  }

  const now = new Date().toISOString();
  await db
    .collection("users")
    .doc(callerUid)
    .set(
      {
        uid: callerUid,
        fullName: callerName,
        displayName: callerName,
        email: callerEmail || "",
        role: "SUPER_ADMIN",
        accountStatus: "ACTIVE",
        createdDate: now,
        updatedDate: now,
        lastLogin: now,
      },
      { merge: true },
    );

  await admin.auth().setCustomUserClaims(callerUid, { role: "SUPER_ADMIN" });

  return { success: true };
});

export const requestHostApproval = functions.https.onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const callerEmail = request.auth?.token.email as string | undefined;
  const callerName =
    (request.auth?.token.name as string | undefined) ||
    callerEmail ||
    "Resident";
  const { householdName, apartmentName, address, notes } = request.data || {};

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  const requestRef = db.collection("hostApplications").doc(callerUid);
  const now = new Date().toISOString();
  await requestRef.set(
    {
      requestId: callerUid,
      userId: callerUid,
      displayName: callerName,
      email: callerEmail || "",
      householdName: householdName || "",
      apartmentName: apartmentName || "",
      address: address || "",
      notes: notes || "",
      status: "PENDING",
      createdDate: now,
      updatedDate: now,
    },
    { merge: true },
  );

  return { success: true, requestId: callerUid };
});

export const approveHostApplication = functions.https.onCall(
  async (request) => {
    const callerUid = request.auth?.uid;
    await assertSuperAdmin(callerUid);

    const { requestId, userId, householdName, apartmentName, address } =
      request.data || {};
    const targetUserId = userId || requestId;

    if (!targetUserId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing host user id.",
      );
    }

    const userDoc = await db.collection("users").doc(targetUserId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "User profile does not exist.",
      );
    }

    const user = userDoc.data() || {};
    const householdRef = db.collection("households").doc();
    const applicationRef = db
      .collection("hostApplications")
      .doc(requestId || targetUserId);
    const now = new Date().toISOString();
    const memberId = targetUserId;

    const batch = db.batch();
    batch.set(householdRef, {
      householdId: householdRef.id,
      householdName: householdName || user.householdName || "New Household",
      apartmentName: apartmentName || "",
      address: address || "",
      hostId: targetUserId,
      status: "ACTIVE",
      createdDate: now,
      updatedDate: now,
    });
    batch.set(householdRef.collection("members").doc(memberId), {
      memberId,
      userId: targetUserId,
      householdId: householdRef.id,
      role: "HOST",
      displayName: user.displayName || user.email || "Host",
      email: user.email || "",
      status: "ACTIVE",
      joinedDate: now.slice(0, 10),
    });
    batch.set(
      db.collection("users").doc(targetUserId),
      {
        role: "HOST",
        householdId: householdRef.id,
        accountStatus: "ACTIVE",
        updatedDate: now,
      },
      { merge: true },
    );
    batch.set(
      applicationRef,
      {
        status: "APPROVED",
        householdId: householdRef.id,
        approvedBy: callerUid,
        updatedDate: now,
      },
      { merge: true },
    );

    await batch.commit();
    await admin
      .auth()
      .setCustomUserClaims(targetUserId, {
        role: "HOST",
        householdId: householdRef.id,
      });

    return { success: true, householdId: householdRef.id };
  },
);

/**
 * Finalize Billing Cycle Function
 * Computes deterministic totals, locks water attendance, writes immutable memberBills snapshots,
 * logs an audit record, and sends notification to all members.
 */
export const finalizeBillingCycle = functions.https.onCall(async (request) => {
  const { householdId, billingCycleId } = request.data;
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  // 1. Verify Host permission
  await assertHostAccess(
    householdId,
    callerUid,
    request.auth?.token.email as string | undefined,
  );

  // 2. Fetch cycle
  const cycleRef = db
    .collection("households")
    .doc(householdId)
    .collection("billingCycles")
    .doc(billingCycleId);
  const cycleDoc = await cycleRef.get();
  if (!cycleDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Billing cycle does not exist.",
    );
  }
  const cycleData = cycleDoc.data() as BillingCycle;

  // 3. Fetch active members
  const membersSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("members")
    .get();
  const members = membersSnap.docs.map((doc) => doc.data() as HouseholdMember);

  // 4. Fetch charges & expenses
  const chargesSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("charges")
    .where("billingCycleId", "==", billingCycleId)
    .get();
  const chargeMap = new Map<string, Charge>();
  chargesSnap.docs.forEach((doc) => {
    const c = doc.data() as Charge;
    chargeMap.set(c.chargeId, c);
  });

  // Also merge any expenses recorded on mobile
  const expensesSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("expenses")
    .where("billingCycleId", "==", billingCycleId)
    .get();
  expensesSnap.docs.forEach((doc) => {
    const exp = doc.data();
    const expId = String(exp.id || exp.expenseId || doc.id);
    if (!chargeMap.has(expId)) {
      const cat = String(exp.category || "").toUpperCase();
      let chargeType: Charge["chargeType"] = "CUSTOM";
      if (cat.includes("RENT")) chargeType = "RENT";
      else if (cat.includes("ELEC")) chargeType = "ELECTRICITY";
      else if (cat.includes("WATER")) chargeType = "WATER";
      else if (
        cat.includes("NET") ||
        cat.includes("WIFI") ||
        cat.includes("INTERNET")
      )
        chargeType = "INTERNET";

      chargeMap.set(expId, {
        chargeId: expId,
        householdId,
        billingCycleId,
        chargeType,
        name: exp.title || exp.name || "Expense",
        description: exp.notes || exp.description || "",
        amountCentavos: Number(exp.amountCents || exp.amountCentavos || 0),
        distributionMethod: "PAYORS_ONLY",
        participantUserIds: [],
        createdDate:
          exp.createdAt || exp.createdDate || new Date().toISOString(),
        createdBy: exp.payerId || "",
      });
    }
  });
  const charges = Array.from(chargeMap.values());

  // 5. Fetch electricity config
  const elecDoc = await db
    .collection("households")
    .doc(householdId)
    .collection("electricityConfig")
    .doc(billingCycleId)
    .get();
  const electricityConfig = elecDoc.exists
    ? (elecDoc.data() as ElectricityConfig)
    : undefined;

  // 6. Fetch water config & attendance
  const waterDoc = await db
    .collection("households")
    .doc(householdId)
    .collection("systemSettings")
    .doc("water")
    .get();
  const waterConfig = waterDoc.exists
    ? (waterDoc.data() as WaterConfig)
    : undefined;

  const attendanceSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("waterAttendance")
    .where("billingCycleId", "==", billingCycleId)
    .get();
  const waterAttendance = attendanceSnap.docs.map(
    (doc) => doc.data() as WaterAttendanceRecord,
  );

  // 7. Calculate billing
  const billingSummary = calculateHouseholdBilling({
    billingCycle: cycleData,
    members,
    charges,
    electricityConfig,
    waterConfig,
    waterAttendance,
  });

  // 8. Atomic batch write: lock attendance, write member bills, update cycle status
  const batch = db.batch();

  // Lock water attendance records
  for (const doc of attendanceSnap.docs) {
    batch.update(doc.ref, { locked: true });
  }

  // Write finalized member bills
  for (const bill of billingSummary.memberBills) {
    const billRef = db
      .collection("households")
      .doc(householdId)
      .collection("memberBills")
      .doc(bill.billId);
    batch.set(billRef, bill);

    // Notify member
    if (bill.totalDueCentavos > 0) {
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        notificationId: notifRef.id,
        recipientId: bill.userId,
        householdId,
        type: "BILL_FINALIZED",
        title: "New Bill Finalized",
        message: `Your bill for ${cycleData.name} is ready: ${formatPesos(bill.totalDueCentavos)}.`,
        relatedEntityId: bill.billId,
        readStatus: false,
        createdTimestamp: new Date().toISOString(),
      });
    }
  }

  // Update billing cycle status to FINALIZED
  batch.update(cycleRef, {
    status: "FINALIZED",
    finalizedDate: new Date().toISOString(),
  });

  // Write immutable audit log
  const auditRef = db.collection("auditLogs").doc();
  batch.set(auditRef, {
    logId: auditRef.id,
    householdId,
    actorId: callerUid,
    actorName: "Host",
    role: "HOST",
    action: "BILLING_FINALIZATION",
    entity: "billingCycle",
    entityId: billingCycleId,
    timestamp: new Date().toISOString(),
    newValue: {
      grandTotalCentavos: billingSummary.grandTotalCentavos,
      memberCount: billingSummary.memberBills.length,
    },
  });

  await batch.commit();

  return {
    success: true,
    grandTotalCentavos: billingSummary.grandTotalCentavos,
    memberBillsCount: billingSummary.memberBills.length,
  };
});

/**
 * Centavo-Safe Balance Redistribution Function
 * Redistributes outstanding unpaid balance from one member to selected recipient Payors.
 */
export const redistributeBalance = functions.https.onCall(async (request) => {
  const {
    householdId,
    billingCycleId,
    sourceUserId,
    recipientUserIds,
    reason,
  } = request.data;
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  // 1. Verify Host permission
  await assertHostAccess(
    householdId,
    callerUid,
    request.auth?.token.email as string | undefined,
  );

  // 2. Fetch source member bill
  const sourceBillId = `${billingCycleId}_${sourceUserId}`;
  const sourceBillRef = db
    .collection("households")
    .doc(householdId)
    .collection("memberBills")
    .doc(sourceBillId);
  const sourceBillDoc = await sourceBillRef.get();

  if (!sourceBillDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Source member bill not found.",
    );
  }
  const sourceBill = sourceBillDoc.data() as MemberBill;

  if (sourceBill.outstandingCentavos <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Member has no outstanding balance to redistribute.",
    );
  }

  // 3. Fetch recipient users
  const recipientsSnap = await db
    .collection("households")
    .doc(householdId)
    .collection("members")
    .where("userId", "in", recipientUserIds)
    .get();

  const recipients = recipientsSnap.docs.map((doc) => {
    const data = doc.data() as HouseholdMember;
    return { userId: data.userId, userName: data.displayName };
  });

  if (recipients.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "At least one recipient payor must be selected.",
    );
  }

  // 4. Calculate deterministic redistribution plan
  const plan = calculateRedistributionPlan(sourceBill, recipients, reason);
  const adjustmentRecord = createAdjustmentRecord(
    plan,
    householdId,
    billingCycleId,
    callerUid,
    reason,
  );

  // 5. Run atomic batch transaction
  const batch = db.batch();

  // Save Adjustment document
  const adjRef = db
    .collection("households")
    .doc(householdId)
    .collection("adjustments")
    .doc(adjustmentRecord.adjustmentId);
  batch.set(adjRef, adjustmentRecord);

  // Update recipients' bills
  for (const alloc of plan.allocations) {
    const recipientBillId = `${billingCycleId}_${alloc.userId}`;
    const recipientBillRef = db
      .collection("households")
      .doc(householdId)
      .collection("memberBills")
      .doc(recipientBillId);
    const recipientDoc = await recipientBillRef.get();

    if (recipientDoc.exists) {
      const recBill = recipientDoc.data() as MemberBill;
      const newAdjustments = recBill.adjustmentsCentavos + alloc.amountCentavos;
      const newTotalDue = recBill.totalDueCentavos + alloc.amountCentavos;
      const newOutstanding = recBill.outstandingCentavos + alloc.amountCentavos;

      batch.update(recipientBillRef, {
        adjustmentsCentavos: newAdjustments,
        totalDueCentavos: newTotalDue,
        outstandingCentavos: newOutstanding,
        status:
          newOutstanding > 0
            ? recBill.paidCentavos > 0
              ? "PARTIALLY_PAID"
              : "UNPAID"
            : "PAID",
        items: [
          ...recBill.items,
          {
            chargeId: adjustmentRecord.adjustmentId,
            chargeType: "CUSTOM",
            name: "Redistributed Balance",
            amountCentavos: alloc.amountCentavos,
            details: `Share of unpaid balance from ${sourceBill.userName}`,
          },
        ],
      });

      // Send notification to recipient
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        notificationId: notifRef.id,
        recipientId: alloc.userId,
        householdId,
        type: "BALANCE_REDISTRIBUTED",
        title: "Balance Adjusted",
        message: `An additional ${formatPesos(alloc.amountCentavos)} was added to your bill from ${sourceBill.userName}'s unpaid balance.`,
        relatedEntityId: adjustmentRecord.adjustmentId,
        readStatus: false,
        createdTimestamp: new Date().toISOString(),
      });
    }
  }

  // Mark source bill as adjusted/relieved
  batch.update(sourceBillRef, {
    outstandingCentavos: 0,
    status: sourceBill.paidCentavos > 0 ? "PARTIALLY_PAID" : "PAID",
    items: [
      ...sourceBill.items,
      {
        chargeId: adjustmentRecord.adjustmentId,
        chargeType: "CUSTOM",
        name: "Relieved via Redistribution",
        amountCentavos: -plan.outstandingCentavos,
        details: `Redistributed to ${recipients.length} roommates`,
      },
    ],
  });

  // Notify source member
  const sourceNotifRef = db.collection("notifications").doc();
  batch.set(sourceNotifRef, {
    notificationId: sourceNotifRef.id,
    recipientId: sourceBill.userId,
    householdId,
    type: "BALANCE_REDISTRIBUTED",
    title: "Outstanding Balance Redistributed",
    message: `Your remaining balance of ${formatPesos(plan.outstandingCentavos)} was redistributed by the Host.`,
    relatedEntityId: adjustmentRecord.adjustmentId,
    readStatus: false,
    createdTimestamp: new Date().toISOString(),
  });

  // Immutable Audit Log
  const auditRef = db.collection("auditLogs").doc();
  batch.set(auditRef, {
    logId: auditRef.id,
    householdId,
    actorId: callerUid,
    actorName: "Host",
    role: "HOST",
    action: "BALANCE_REDISTRIBUTION",
    entity: "adjustment",
    entityId: adjustmentRecord.adjustmentId,
    timestamp: new Date().toISOString(),
    previousValue: {
      sourceUserId: sourceBill.userId,
      unpaidCentavos: plan.outstandingCentavos,
    },
    newValue: {
      totalRedistributedCentavos: plan.totalRedistributedCentavos,
      allocations: plan.allocations,
    },
    reason,
  });

  await batch.commit();

  return {
    success: true,
    plan,
    adjustmentId: adjustmentRecord.adjustmentId,
  };
});

/**
 * Payment submission bridge for clients.
 * Validates the signed-in account against the member profile, writes the payment,
 * and notifies the Host without granting broad client-side write access.
 */
export const submitPayment = functions.https.onCall(async (request) => {
  const {
    householdId,
    billingCycleId,
    amountCentavos,
    paymentMethod,
    referenceNumber,
    proofOfPaymentUrl,
    notes,
    localUserId,
  } = request.data;
  const callerUid = request.auth?.uid;
  const callerEmail = request.auth?.token.email as string | undefined;

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  if (
    !householdId ||
    !billingCycleId ||
    !amountCentavos ||
    !paymentMethod ||
    !referenceNumber
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required payment fields.",
    );
  }

  if (amountCentavos <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Payment amount must be positive.",
    );
  }

  const userDoc = await db.collection("users").doc(callerUid).get();
  const authProfile = userDoc.data();
  let paymentUserId = callerUid;
  let paymentUserName =
    authProfile?.displayName || request.auth?.token.name || "Resident";

  if (localUserId && localUserId !== callerUid) {
    const localProfileDoc = await db.collection("users").doc(localUserId).get();
    const localProfile = localProfileDoc.data();
    const localEmail = localProfile?.email;

    if (
      !callerEmail ||
      typeof localEmail !== "string" ||
      localEmail.toLowerCase() !== callerEmail.toLowerCase()
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Signed-in account does not match this member.",
      );
    }

    paymentUserId = localUserId;
    paymentUserName = localProfile?.displayName || paymentUserName;
  } else if (authProfile?.householdId !== householdId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User is not a member of this household.",
    );
  }

  const householdDoc = await db.collection("households").doc(householdId).get();
  if (!householdDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Household does not exist.",
    );
  }

  const paymentRef = db
    .collection("households")
    .doc(householdId)
    .collection("payments")
    .doc();
  const payment = {
    paymentId: paymentRef.id,
    userId: paymentUserId,
    userName: paymentUserName,
    householdId,
    billingCycleId,
    amountCentavos,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod,
    referenceNumber,
    proofOfPaymentUrl,
    notes,
    status: "PENDING",
    createdDate: new Date().toISOString(),
  };

  const batch = db.batch();
  batch.set(paymentRef, payment);

  const notifRef = db.collection("notifications").doc();
  batch.set(notifRef, {
    notificationId: notifRef.id,
    recipientId: householdDoc.data()?.hostId,
    householdId,
    type: "PAYMENT_SUBMITTED",
    title: "New Payment Submitted",
    message: `${paymentUserName} submitted payment of ${formatPesos(amountCentavos)} (${paymentMethod}).`,
    relatedEntityId: paymentRef.id,
    readStatus: false,
    createdTimestamp: new Date().toISOString(),
  });

  await batch.commit();

  return { success: true, payment };
});

/**
 * Payment Verification Function
 * Verifies or rejects submitted payment with reason, recalculates balances, and notifies user.
 */
export const verifyPayment = functions.https.onCall(async (request) => {
  const { householdId, paymentId, approved, rejectionReason } = request.data;
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in.",
    );
  }

  await assertHostAccess(
    householdId,
    callerUid,
    request.auth?.token.email as string | undefined,
  );

  const paymentRef = db
    .collection("households")
    .doc(householdId)
    .collection("payments")
    .doc(paymentId);
  const paymentDoc = await paymentRef.get();
  if (!paymentDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Payment record not found.",
    );
  }
  const payment = paymentDoc.data() as Payment;

  const batch = db.batch();
  const billId = `${payment.billingCycleId}_${payment.userId}`;
  const billRef = db
    .collection("households")
    .doc(householdId)
    .collection("memberBills")
    .doc(billId);
  const billDoc = await billRef.get();

  if (approved) {
    batch.update(paymentRef, {
      status: "VERIFIED",
      verifiedDate: new Date().toISOString(),
      verifiedBy: callerUid,
    });

    if (billDoc.exists) {
      const bill = billDoc.data() as MemberBill;
      const newPaid = bill.paidCentavos + payment.amountCentavos;
      const newOutstanding = Math.max(0, bill.totalDueCentavos - newPaid);
      const newStatus = newOutstanding === 0 ? "PAID" : "PARTIALLY_PAID";

      batch.update(billRef, {
        paidCentavos: newPaid,
        outstandingCentavos: newOutstanding,
        status: newStatus,
      });
    }

    // Send notification to payor
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      notificationId: notifRef.id,
      recipientId: payment.userId,
      householdId,
      type: "PAYMENT_VERIFIED",
      title: "Payment Approved!",
      message: `Your payment of ${formatPesos(payment.amountCentavos)} has been verified by the Host.`,
      relatedEntityId: paymentId,
      readStatus: false,
      createdTimestamp: new Date().toISOString(),
    });
  } else {
    batch.update(paymentRef, {
      status: "REJECTED",
      rejectionReason:
        rejectionReason || "Invalid proof of payment or reference number.",
      verifiedDate: new Date().toISOString(),
      verifiedBy: callerUid,
    });

    // Send notification with reason
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      notificationId: notifRef.id,
      recipientId: payment.userId,
      householdId,
      type: "PAYMENT_REJECTED",
      title: "Payment Rejected",
      message: `Your payment of ${formatPesos(payment.amountCentavos)} was rejected: ${rejectionReason}`,
      relatedEntityId: paymentId,
      readStatus: false,
      createdTimestamp: new Date().toISOString(),
    });
  }

  // Audit log
  const auditRef = db.collection("auditLogs").doc();
  batch.set(auditRef, {
    logId: auditRef.id,
    householdId,
    actorId: callerUid,
    actorName: "Host",
    role: "HOST",
    action: approved ? "PAYMENT_APPROVAL" : "PAYMENT_REJECTION",
    entity: "payment",
    entityId: paymentId,
    timestamp: new Date().toISOString(),
    newValue: {
      status: approved ? "VERIFIED" : "REJECTED",
      amountCentavos: payment.amountCentavos,
    },
    reason: rejectionReason,
  });

  await batch.commit();

  return { success: true, approved };
});
