import React, { useState, useEffect } from "react";
import { mobileDataService } from "../services/firebaseDataService";
import {
  evaluateVersionGate,
  VersionGateEvaluation,
} from "../utils/versionUtils";
import { AppUpdateGateModal } from "./AppUpdateGateModal";

interface GlobalAppVersionGateProps {
  /** If true, gate is paused during initial splash animation */
  isSplashActive?: boolean;
}

export const GlobalAppVersionGate: React.FC<GlobalAppVersionGateProps> = ({
  isSplashActive = false,
}) => {
  const [evaluation, setEvaluation] = useState<VersionGateEvaluation | null>(
    null,
  );
  const [dismissedOptional, setDismissedOptional] = useState<boolean>(false);

  useEffect(() => {
    const unsub = mobileDataService.listenToPlatformSettings((settings) => {
      if (settings) {
        const result = evaluateVersionGate(settings);
        setEvaluation(result);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Do not pop up over the splash chime/logo animation; wait until splash finishes
  if (isSplashActive) {
    return null;
  }

  if (!evaluation || !evaluation.hasUpdate) {
    return null;
  }

  // If optional update was dismissed for this session, hide it
  if (!evaluation.isMandatory && dismissedOptional) {
    return null;
  }

  return (
    <AppUpdateGateModal
      visible={true}
      evaluation={evaluation}
      onDismissOptional={() => setDismissedOptional(true)}
    />
  );
};
