import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  sendEmailVerification,
} from "firebase/auth";
import { UserProfile, UserRole } from "@propertyflow/shared";
import { auth } from "../firebase/config";
import { firebaseDataService } from "../services/firebaseDataService";

export interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  loading: boolean;
  role: UserRole;
  isHost: boolean;
  isPayor: boolean;
  isNonPayor: boolean;
  isSuperAdmin: boolean;
  switchUser: (userId: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  allUsers: UserProfile[];
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
}

const emptyUser: UserProfile = {
  uid: "",
  fullName: "",
  displayName: "",
  email: "",
  role: "PAYOR",
  accountStatus: "ACTIVE",
  createdDate: "",
  updatedDate: "",
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(emptyUser);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      try {
        if (!firebaseUser) {
          setCurrentUser(emptyUser);
          setAllUsers([]);
          setIsEmailVerified(true);
          return;
        }

        setIsEmailVerified(firebaseUser.emailVerified);

        const existing = await firebaseDataService.getUserProfile(
          firebaseUser.uid,
        );
        const now = new Date().toISOString();
        const role =
          existing?.role === "SUPER_ADMIN"
            ? "SUPER_ADMIN"
            : existing?.role === "HOST" ||
                existing?.hostApplicationStatus === "APPROVED"
              ? "HOST"
              : existing?.role || "PAYOR";

        const profile: UserProfile = {
          uid: firebaseUser.uid,
          fullName:
            existing?.fullName ||
            firebaseUser.displayName ||
            firebaseUser.email ||
            "Resident",
          displayName:
            existing?.displayName ||
            firebaseUser.displayName ||
            firebaseUser.email ||
            "Resident",
          email: existing?.email || firebaseUser.email || "",
          role,
          accountStatus: existing?.accountStatus || "ACTIVE",
          householdId: existing?.householdId,
          phoneNumber: existing?.phoneNumber,
          profilePicture:
            existing?.profilePicture || firebaseUser.photoURL || undefined,
          hostApplicationStatus: existing?.hostApplicationStatus,
          hostApplicationId: existing?.hostApplicationId,
          createdDate: existing?.createdDate || now,
          updatedDate: now,
          lastLogin: now,
          notificationPreferences: existing?.notificationPreferences,
        };

        // Non-blocking sync to cloud so auth state resolves immediately
        firebaseDataService.saveUserProfile(profile).catch((err) => {
          console.warn("[Auth] Background saveUserProfile warning:", err);
        });

        setCurrentUser(profile);
        setAllUsers([profile]);

        // Real-time listener for user profile changes (role upgrade, household deletion, etc.)
        unsubProfile = firebaseDataService.listenToUserProfile(
          firebaseUser.uid,
          (updated) => {
            if (updated) {
              setCurrentUser((prev) => ({
                ...prev,
                ...updated,
                uid: firebaseUser.uid,
              }));
            }
          },
        );
      } catch (err) {
        console.error("[Auth] Error setting up user profile:", err);
        if (firebaseUser) {
          const fallback: UserProfile = {
            uid: firebaseUser.uid,
            fullName:
              firebaseUser.displayName || firebaseUser.email || "Resident",
            displayName:
              firebaseUser.displayName || firebaseUser.email || "Resident",
            email: firebaseUser.email || "",
            role: "PAYOR",
            accountStatus: "ACTIVE",
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
          };
          setCurrentUser(fallback);
          setAllUsers([fallback]);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubscribe();
    };
  }, []);

  const switchUser = () => {
    console.warn(
      "[Auth] Demo user switching has been removed. Sign in with the intended Firebase account.",
    );
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser.uid) return;
    const updated = {
      ...currentUser,
      ...updates,
      updatedDate: new Date().toISOString(),
    };
    await firebaseDataService.saveUserProfile(updated);
    setCurrentUser(updated);
    setAllUsers([updated]);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(emptyUser);
    setAllUsers([]);
    setIsEmailVerified(true);
  };

  const sendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const verified = auth.currentUser.emailVerified;
      setIsEmailVerified(verified);
      if (!currentUser.uid && auth.currentUser.uid) {
        const u = auth.currentUser;
        const profile: UserProfile = {
          uid: u.uid,
          fullName: u.displayName || u.email || "Resident",
          displayName: u.displayName || u.email || "Resident",
          email: u.email || "",
          role: "PAYOR",
          accountStatus: "ACTIVE",
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
        };
        setCurrentUser(profile);
        setAllUsers([profile]);
      }
      return verified;
    }
    return false;
  };

  const isAuthenticated = !loading && Boolean(currentUser.uid);
  const isHost =
    currentUser.role === "HOST" ||
    currentUser.hostApplicationStatus === "APPROVED";
  const isPayor = currentUser.role === "PAYOR";
  const isNonPayor = currentUser.role === "NON_PAYOR";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isEmailVerified,
        loading,
        role: currentUser.role,
        isHost,
        isPayor,
        isNonPayor,
        isSuperAdmin,
        switchUser,
        updateProfile,
        allUsers,
        signOut,
        sendVerificationEmail,
        reloadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default useAuth;
