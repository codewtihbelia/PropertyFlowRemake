import React, { useState, useRef, useEffect } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { useAuth } from "../../contexts/AuthContext";
import { uploadImageToCloudinary } from "../../services/cloudinaryService";
import { firebaseDataService } from "../../services/firebaseDataService";
import {
  Settings,
  Save,
  Home,
  Camera,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const HostSettings: React.FC = () => {
  const {
    household,
    updateHousehold,
    loading: householdLoading,
  } = useHousehold();
  const { currentUser, updateProfile, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (
    (householdLoading && !household.householdId) ||
    (authLoading && !currentUser.uid)
  ) {
    return <UniversalLoader variant="skeleton" type="settings" />;
  }

  const [name, setName] = useState(household.householdName);
  const [apt, setApt] = useState(household.apartmentName);
  const [address, setAddress] = useState(household.address);
  const [desc, setDesc] = useState(household.description || "");

  // Host Profile
  const [hostDisplayName, setHostDisplayName] = useState(
    currentUser.displayName,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (currentUser.displayName) {
      setHostDisplayName(currentUser.displayName);
    }
  }, [currentUser.displayName]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setPhotoMessage({
        type: "error",
        text: "Image size should be less than 10MB.",
      });
      return;
    }

    try {
      setUploadingPhoto(true);
      setPhotoMessage(null);
      const secureUrl = await uploadImageToCloudinary(file);
      await updateProfile({
        profilePicture: secureUrl,
      });
      if (currentUser.uid) {
        await firebaseDataService.updateUserProfilePicture(
          currentUser.uid,
          secureUrl,
          household.householdId,
        );
      }
      setPhotoMessage({
        type: "success",
        text: "Host profile picture updated and synced!",
      });
    } catch (err: any) {
      console.error("Cloudinary photo upload error:", err);
      setPhotoMessage({
        type: "error",
        text: err.message || "Failed to upload photo.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateHousehold({
      householdName: name,
      apartmentName: apt,
      address,
      description: desc,
    });
    if (hostDisplayName !== currentUser.displayName) {
      updateProfile({ displayName: hostDisplayName });
    }
    alert("Settings updated successfully.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
          <Settings className="w-3.5 h-3.5" />
          <span>Household Configuration</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
          Host & Household Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your host profile, avatar and apartment details
        </p>
      </div>

      {/* Host Profile & Avatar Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
          <User className="w-3.5 h-3.5" />
          <span>Host Profile</span>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="relative group">
            {currentUser.profilePicture || (currentUser as any)?.photoURL ? (
              <img
                src={
                  currentUser.profilePicture || (currentUser as any)?.photoURL
                }
                alt={currentUser.displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                {currentUser.displayName?.charAt(0).toUpperCase() || "H"}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
              title="Change Photo"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {uploadingPhoto
                  ? "Uploading to Cloudinary..."
                  : "Upload Host Photo"}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 mt-1">
              JPG, PNG or WEBP (Max 10MB). Synced across Web & Mobile via
              Cloudinary.
            </p>
          </div>
        </div>

        {photoMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              photoMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {photoMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{photoMessage.text}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Host Display Name
          </label>
          <input
            type="text"
            value={hostDisplayName}
            onChange={(e) => setHostDisplayName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Household Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Apartment / Room Unit
            </label>
            <input
              type="text"
              value={apt}
              onChange={(e) => setApt(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Property Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};
