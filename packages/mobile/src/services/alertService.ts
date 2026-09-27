import { Alert, Platform } from "react-native";

export type AlertType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "confirm"
  | "destructive";

export interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface CustomAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
  type?: AlertType;
}

export interface CustomAlertConfig {
  id?: string;
  title: string;
  message?: string;
  buttons?: CustomAlertButton[];
  options?: CustomAlertOptions;
  type?: AlertType;
}

type AlertListener = (config: CustomAlertConfig | null) => void;

class AlertService {
  private listener: AlertListener | null = null;
  private currentAlert: CustomAlertConfig | null = null;
  private isPatched = false;
  private originalAlertAlert: typeof Alert.alert | null = null;

  public register(listener: AlertListener) {
    this.listener = listener;
    if (this.currentAlert) {
      listener(this.currentAlert);
    }
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  public show(config: CustomAlertConfig) {
    const inferredType =
      config.type ||
      this.inferType(config.title, config.message, config.buttons);
    this.currentAlert = {
      ...config,
      type: inferredType,
      id: Math.random().toString(36).substring(7),
    };
    if (this.listener) {
      this.listener(this.currentAlert);
    }
  }

  public dismiss() {
    this.currentAlert = null;
    if (this.listener) {
      this.listener(null);
    }
  }

  public getCurrentAlert() {
    return this.currentAlert;
  }

  private inferType(
    title: string = "",
    message: string = "",
    buttons?: CustomAlertButton[],
  ): AlertType {
    const combined = `${title} ${message}`.toLowerCase();

    // Check for destructive button or words
    if (
      buttons?.some((b) => b.style === "destructive") ||
      combined.includes("delete") ||
      combined.includes("remove member") ||
      combined.includes("remove") ||
      combined.includes("sign out") ||
      combined.includes("log out") ||
      combined.includes("decline") ||
      combined.includes("discard") ||
      combined.includes("are you sure")
    ) {
      return "destructive";
    }

    // Check for error / failure
    if (
      combined.includes("could not") ||
      combined.includes("failed") ||
      combined.includes("failure") ||
      combined.includes("error") ||
      combined.includes("invalid") ||
      combined.includes("denied") ||
      combined.includes("weak password") ||
      combined.includes("required field") ||
      combined.includes("required") ||
      combined.includes("cannot be empty")
    ) {
      return "error";
    }

    // Check for warning / notice
    if (
      combined.includes("warning") ||
      combined.includes("notice") ||
      combined.includes("caution") ||
      combined.includes("attention") ||
      combined.includes("lock")
    ) {
      return "warning";
    }

    // Check for success
    if (
      combined.includes("success") ||
      combined.includes("request sent") ||
      combined.includes("verified") ||
      combined.includes("saved") ||
      combined.includes("updated") ||
      combined.includes("created") ||
      combined.includes("submitted") ||
      combined.includes("approved") ||
      combined.includes("joined") ||
      combined.includes("done") ||
      combined.includes("added")
    ) {
      return "success";
    }

    // Check if confirm prompt with cancel + ok
    if (buttons && buttons.length >= 2) {
      return "confirm";
    }

    return "info";
  }

  public initAlertPatch() {
    if (this.isPatched) return;
    this.isPatched = true;

    // Save original if needed
    this.originalAlertAlert = Alert.alert;

    // Monkey-patch Alert.alert
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: any[],
      options?: any,
    ) => {
      // If no listener is registered yet (very early during startup), fallback to original
      if (!this.listener && this.originalAlertAlert) {
        this.originalAlertAlert(title, message, buttons, options);
        return;
      }

      const formattedButtons: CustomAlertButton[] =
        buttons && buttons.length > 0
          ? buttons.map((b) => ({
              text: b.text || "OK",
              onPress: b.onPress,
              style: b.style,
            }))
          : [{ text: "OK" }];

      this.show({
        title,
        message,
        buttons: formattedButtons,
        options: options || {},
      });
    };
  }

  public showSuccess(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "success",
      buttons: [{ text: "Got It", onPress: onConfirm, style: "default" }],
    });
  }

  public showError(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "error",
      buttons: [{ text: "Got It", onPress: onConfirm, style: "default" }],
    });
  }

  public showWarning(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "warning",
      buttons: [{ text: "Understood", onPress: onConfirm, style: "default" }],
    });
  }

  public showInfo(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "info",
      buttons: [{ text: "OK", onPress: onConfirm, style: "default" }],
    });
  }

  public showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false,
  ) {
    this.show({
      title,
      message,
      type: isDestructive ? "destructive" : "confirm",
      buttons: [
        { text: cancelText, onPress: onCancel, style: "cancel" },
        {
          text: confirmText,
          onPress: onConfirm,
          style: isDestructive ? "destructive" : "default",
        },
      ],
    });
  }
}

export const alertService = new AlertService();

export const showAlert = (config: CustomAlertConfig) =>
  alertService.show(config);
export const dismissAlert = () => alertService.dismiss();
export const showSuccessAlert = (
  title: string,
  message?: string,
  onConfirm?: () => void,
) => alertService.showSuccess(title, message, onConfirm);
export const showErrorAlert = (
  title: string,
  message?: string,
  onConfirm?: () => void,
) => alertService.showError(title, message, onConfirm);
export const showWarningAlert = (
  title: string,
  message?: string,
  onConfirm?: () => void,
) => alertService.showWarning(title, message, onConfirm);
export const showInfoAlert = (
  title: string,
  message?: string,
  onConfirm?: () => void,
) => alertService.showInfo(title, message, onConfirm);
export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText?: string,
  cancelText?: string,
  isDestructive?: boolean,
) =>
  alertService.showConfirm(
    title,
    message,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    isDestructive,
  );
