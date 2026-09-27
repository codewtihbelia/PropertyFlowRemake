export type WebAlertType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "destructive"
  | "confirm";

export interface WebAlertButton {
  text: string;
  onClick?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface WebAlertConfig {
  id?: string;
  title: string;
  message?: string;
  type?: WebAlertType;
  buttons?: WebAlertButton[];
  onDismiss?: () => void;
}

type WebAlertListener = (config: WebAlertConfig | null) => void;

class WebAlertService {
  private listener: WebAlertListener | null = null;
  private currentAlert: WebAlertConfig | null = null;
  private isPatched = false;

  public register(listener: WebAlertListener) {
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

  public show(config: WebAlertConfig) {
    const inferredType =
      config.type || this.inferType(config.title, config.message);
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

  private inferType(title: string = "", message: string = ""): WebAlertType {
    const combined = `${title} ${message}`.toLowerCase();

    if (
      combined.includes("delete") ||
      combined.includes("remove") ||
      combined.includes("discard") ||
      combined.includes("decline") ||
      combined.includes("reject") ||
      combined.includes("are you sure")
    ) {
      return "destructive";
    }

    if (
      combined.includes("could not") ||
      combined.includes("failed") ||
      combined.includes("error") ||
      combined.includes("invalid") ||
      combined.includes("denied") ||
      combined.includes("cannot")
    ) {
      return "error";
    }

    if (
      combined.includes("warning") ||
      combined.includes("notice") ||
      combined.includes("caution") ||
      combined.includes("locked") ||
      combined.includes("select")
    ) {
      return "warning";
    }

    if (
      combined.includes("success") ||
      combined.includes("approved") ||
      combined.includes("saved") ||
      combined.includes("updated") ||
      combined.includes("created") ||
      combined.includes("submitted") ||
      combined.includes("executed")
    ) {
      return "success";
    }

    return "info";
  }

  public initWebAlertPatch() {
    if (typeof window === "undefined" || this.isPatched) return;
    this.isPatched = true;

    // Patch window.alert to display modern UI modal
    window.alert = (message?: any) => {
      const msgStr =
        typeof message === "string" ? message : JSON.stringify(message);
      let title = "Notice";

      // Detect common status phrases for title
      const lower = msgStr.toLowerCase();
      if (lower.includes("success")) title = "Success";
      else if (lower.includes("fail") || lower.includes("error"))
        title = "Error";
      else if (lower.includes("submitted")) title = "Submitted";
      else if (lower.includes("saved") || lower.includes("updated"))
        title = "Saved";
      else if (lower.includes("locked")) title = "Notice";
      else if (lower.includes("approved")) title = "Approved";
      else if (lower.includes("declined")) title = "Declined";

      this.show({
        title,
        message: msgStr,
        buttons: [{ text: "Got It", style: "default" }],
      });
    };
  }

  public showSuccess(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "success",
      buttons: [{ text: "Got It", onClick: onConfirm, style: "default" }],
    });
  }

  public showError(title: string, message?: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: "error",
      buttons: [{ text: "Got It", onClick: onConfirm, style: "default" }],
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
        { text: cancelText, onClick: onCancel, style: "cancel" },
        {
          text: confirmText,
          onClick: onConfirm,
          style: isDestructive ? "destructive" : "default",
        },
      ],
    });
  }
}

export const webAlertService = new WebAlertService();
export const showWebAlert = (config: WebAlertConfig) =>
  webAlertService.show(config);
