import React from "react";
import { Employee, Product, SystemSettings } from "../../types";
import { PinVerificationModal } from "./PinVerificationModal";
import { UserSwitchModal } from "../UserSwitchModal";
import StockReplenishModal from "../StockReplenishModal";
import QuickLogoModal from "../QuickLogoModal";
import { SystemInfoHub } from "../SystemInfoHub";

export interface AppModalsContainerProps {
  // Shared
  theme: "daily" | "night" | string;
  employees: Employee[];
  activeUser: Employee | null;
  settings: SystemSettings;
  showToast: (message: string, type?: "success" | "error" | "info" | "warning", title?: string) => void;
  handleAddAuditLog: (action: string, module: string, details: string, customUser?: Employee) => void;

  // PIN Verification Modal
  pinVerificationOpen: boolean;
  onClosePinVerification: () => void;
  pinTargetEmployee: Employee | null;
  onPinTargetEmployeeChange: (emp: Employee | null) => void;
  loginMethod: "select" | "type";
  onLoginMethodChange: (method: "select" | "type") => void;
  enteredUsername: string;
  onEnteredUsernameChange: (username: string) => void;
  enteredPin: string;
  onEnteredPinChange: (pin: string) => void;
  pinError: string;
  onVerifyPin: () => void;

  // User Switch Modal
  isUserSwitchModalOpen: boolean;
  onCloseUserSwitchModal: () => void;
  onSelectEmployeeForSwitch: (emp: Employee) => void;

  // Stock Replenish Modal
  showReplenishModal: boolean;
  onCloseReplenishModal: () => void;
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  activeBranchId: string;

  // Quick Logo Modal
  isQuickLogoModalOpen: boolean;
  onCloseQuickLogoModal: () => void;
  currentLogoUrl?: string;
  companyDisplayName: string;
  onSaveLogo: (newLogoUrl: string) => void;

  // System Info Hub Modal
  isSystemInfoHubOpen: boolean;
  onCloseSystemInfoHub: () => void;
  isOnline: boolean;
  currentSystemVersion: string;
  sessionStartTime: number;
  onOpenUserSwitch: () => void;
  onOpenLogoModal: () => void;
  onOpenTutorial?: () => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  theme,
  employees,
  activeUser,
  settings,
  showToast,
  handleAddAuditLog,

  pinVerificationOpen,
  onClosePinVerification,
  pinTargetEmployee,
  onPinTargetEmployeeChange,
  loginMethod,
  onLoginMethodChange,
  enteredUsername,
  onEnteredUsernameChange,
  enteredPin,
  onEnteredPinChange,
  pinError,
  onVerifyPin,

  isUserSwitchModalOpen,
  onCloseUserSwitchModal,
  onSelectEmployeeForSwitch,

  showReplenishModal,
  onCloseReplenishModal,
  products,
  onUpdateProduct,
  activeBranchId,

  isQuickLogoModalOpen,
  onCloseQuickLogoModal,
  currentLogoUrl,
  companyDisplayName,
  onSaveLogo,

  isSystemInfoHubOpen,
  onCloseSystemInfoHub,
  isOnline,
  currentSystemVersion,
  sessionStartTime,
  onOpenUserSwitch,
  onOpenLogoModal,
}) => {
  return (
    <>
      {/* Profile PIN Verification Modal */}
      <PinVerificationModal
        isOpen={pinVerificationOpen}
        onClose={onClosePinVerification}
        pinTargetEmployee={pinTargetEmployee}
        onPinTargetEmployeeChange={onPinTargetEmployeeChange}
        loginMethod={loginMethod}
        onLoginMethodChange={onLoginMethodChange}
        employees={employees}
        activeUser={activeUser}
        enteredUsername={enteredUsername}
        onEnteredUsernameChange={onEnteredUsernameChange}
        enteredPin={enteredPin}
        onEnteredPinChange={onEnteredPinChange}
        pinError={pinError}
        onVerifyPin={onVerifyPin}
        theme={theme}
      />

      {/* User Switch Modal */}
      <UserSwitchModal
        isOpen={isUserSwitchModalOpen}
        onClose={onCloseUserSwitchModal}
        employees={employees}
        activeUser={activeUser}
        onSelectEmployee={onSelectEmployeeForSwitch}
        onAddAuditLog={handleAddAuditLog}
        theme={theme}
      />

      {/* Stock Replenish Modal */}
      <StockReplenishModal
        isOpen={showReplenishModal}
        onClose={onCloseReplenishModal}
        products={products}
        onUpdateProduct={onUpdateProduct}
        onShowToast={showToast}
        activeBranchId={activeBranchId}
        theme={theme}
      />

      {/* Quick Logo Config Modal */}
      <QuickLogoModal
        isOpen={isQuickLogoModalOpen}
        onClose={onCloseQuickLogoModal}
        currentLogoUrl={currentLogoUrl}
        companyName={companyDisplayName}
        theme={theme}
        onSaveLogo={onSaveLogo}
        onShowToast={showToast}
      />

      {/* Unified System Info Hub Modal */}
      <SystemInfoHub
        isOpen={isSystemInfoHubOpen}
        onClose={onCloseSystemInfoHub}
        isOnline={isOnline}
        companyName={companyDisplayName}
        logoUrl={settings.logoUrl}
        version={currentSystemVersion}
        sessionSeconds={Math.floor((Date.now() - sessionStartTime) / 1000)}
        activeUser={activeUser}
        onSwitchUser={onOpenUserSwitch}
        onOpenLogoModal={onOpenLogoModal}
        theme={theme}
      />
    </>
  );
};
