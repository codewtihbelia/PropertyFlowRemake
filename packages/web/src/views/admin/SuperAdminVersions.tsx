import React, { useState } from "react";
import { adminService } from "../../services/adminService";
import { AppVersion } from "@propertyflow/shared";
import { Smartphone, Save, Shield, AlertCircle } from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const SuperAdminVersions: React.FC<{ loading?: boolean }> = ({
  loading = false,
}) => {
  const versions = adminService.getAppVersions();
  const [selectedVer, setSelectedVer] = useState<AppVersion>(versions[0]);
  const [minVer, setMinVer] = useState(selectedVer.minimumSupportedVersion);
  const [latestVer, setLatestVer] = useState(selectedVer.latestVersion);
  const [mandatory, setMandatory] = useState(selectedVer.mandatoryUpdate);
  const [notes, setNotes] = useState(selectedVer.releaseNotes);

  if (loading) {
    return <UniversalLoader variant="skeleton" type="settings" />;
  }

  const handleSelect = (v: AppVersion) => {
    setSelectedVer(v);
    setMinVer(v.minimumSupportedVersion);
    setLatestVer(v.latestVersion);
    setMandatory(v.mandatoryUpdate);
    setNotes(v.releaseNotes);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    adminService.updateAppVersion({
      ...selectedVer,
      minimumSupportedVersion: minVer,
      latestVersion: latestVer,
      mandatoryUpdate: mandatory,
      releaseNotes: notes,
    });
    alert(
      `Version configuration for ${selectedVer.platform} updated successfully.`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Release Engineering</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mt-1">
          App Version Management
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure minimum supported versions, latest releases, and forced
          update flags for Android, iOS, and Web
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Platform Selection Cards */}
        <div className="space-y-3">
          {versions.map((v) => (
            <button
              key={v.versionId}
              onClick={() => handleSelect(v)}
              className={`w-full p-4 rounded-2xl border text-left transition ${
                selectedVer.versionId === v.versionId
                  ? "border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-slate-900">
                  {v.platform}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  v{v.latestVersion}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Min Supported: v{v.minimumSupportedVersion}
              </div>
            </button>
          ))}
        </div>

        {/* Edit Configuration Form */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Configure {selectedVer.platform} Target Release
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latest Version
                </label>
                <input
                  type="text"
                  required
                  value={latestVer}
                  onChange={(e) => setLatestVer(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Supported Version
                </label>
                <input
                  type="text"
                  required
                  value={minVer}
                  onChange={(e) => setMinVer(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mandatoryCheck"
                checked={mandatory}
                onChange={(e) => setMandatory(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="mandatoryCheck"
                className="text-xs font-bold text-slate-800"
              >
                Force Mandatory App Update (Blocks older versions)
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Release Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Version Settings
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
