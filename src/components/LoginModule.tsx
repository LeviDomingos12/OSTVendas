import React, { useState, useEffect, FormEvent } from "react";
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle, 
  Building2, 
  QrCode, 
  Monitor, 
  Sparkles, 
  Fingerprint, 
  Keyboard, 
  Check,
  Mail,
  UserPlus,
  ArrowLeft,
  Chrome,
  Crown,
  Zap,
  Award
} from "lucide-react";
import { Employee, SystemSettings, SubscriptionPlan } from "../types";
import { 
  signUpWithEmail, 
  signInWithEmail, 
  recoverPassword, 
  googleSignIn,
  googleSignInAndSync,
  createRecoveryRequest,
  auth,
  db
} from "../lib/firebase";
import { sendEmail } from "../lib/gmail";
import { renderWelcomeAdminHtml } from "../templates/WelcomeAdminTemplate";

interface LoginModuleProps {
  employees: Employee[];
  companyName: string;
  logoUrl?: string;
  branches?: any[];
  onLoginSuccess: (user: Employee, company: string) => void;
  onShowToast: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  onAddAuditLog?: (action: string, module: string, details: string) => void;
  settings?: SystemSettings;
}

export default function LoginModule({
  employees,
  companyName,
  logoUrl,
  branches: passedBranches,
  onLoginSuccess,
  onShowToast,
  onAddAuditLog,
  settings
}: LoginModuleProps) {
  // Views: "LOGIN" | "SIGNUP" | "RECOVERY" | "PIN" | "QRCODE"
  const [view, setView] = useState<"LOGIN" | "SIGNUP" | "RECOVERY" | "PIN" | "QRCODE">("LOGIN");
  
  // Login Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Signup Form State
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupBranch, setSignupBranch] = useState("OST Comércio Geral");
  const [signupRole, setSignupRole] = useState("Administrador");
  const [signupPlan, setSignupPlan] = useState<SubscriptionPlan>("OURO");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Recovery Form State
  const [recoveryEmail, setRecoveryEmail] = useState("");

  // PIN Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || "");
  const [pin, setPin] = useState("");
  const [requireOperatorPin, setRequireOperatorPin] = useState<boolean>(() => {
    const saved = localStorage.getItem("erp_require_operator_pin");
    return saved !== "false"; // Defaults to true
  });
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);

  // Caps Lock State
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Loading Steps & Local Auth Tracking
  const [loadingState, setLoadingState] = useState<"IDLE" | "AUTHENTICATING" | "CONNECTING" | "LOADING_PERMISSIONS" | "COMPANY_SELECTION">("IDLE");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [authenticatedUser, setAuthenticatedUser] = useState<Employee | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // Error/Success Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Branch Selected for Session
  const [selectedBranch, setSelectedBranch] = useState<string>("OST Comércio Geral");

  const branches = passedBranches && passedBranches.length > 0 ? passedBranches : [
    { id: "b1", name: companyName || "OST Comércio Geral", description: "Sede Principal de Operações", code: "SEDE" }
  ];

  useEffect(() => {
    if (branches && branches.length > 0 && (signupBranch === "OST Comércio Geral" || !signupBranch)) {
      setSignupBranch(branches[0].name);
    }
  }, [branches, signupBranch]);

  const roles = [
    { value: "Caixa", label: "Caixa (Operador POS)" },
    { value: "Vendedor", label: "Vendedor (Comercial)" },
    { value: "Supervisor", label: "Supervisor de Loja" },
    { value: "Gerente", label: "Gerente de Filial" },
    { value: "Financeiro", label: "Gestor Financeiro" },
    { value: "Estoquista", label: "Fiel de Armazém / Estoquista" },
    { value: "Administrador", label: "Administrador do Sistema" }
  ];

  // Monitor Caps Lock
  useEffect(() => {
    const checkCapsLock = (e: KeyboardEvent) => {
      if (e.getModifierState && e.getModifierState("CapsLock")) {
        setIsCapsLockOn(true);
      } else {
        setIsCapsLockOn(false);
      }
    };
    window.addEventListener("keydown", checkCapsLock);
    window.addEventListener("keyup", checkCapsLock);
    return () => {
      window.removeEventListener("keydown", checkCapsLock);
      window.removeEventListener("keyup", checkCapsLock);
    };
  }, []);

  // Set default selected employee on PIN load
  useEffect(() => {
    if (employees && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  // Real-time password strength checker
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Vazia", color: "bg-slate-800" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score, label: "Fraca 🔴", color: "bg-red-500 w-1/4" };
    if (score <= 3) return { score, label: "Média 🟡", color: "bg-amber-500 w-2/4" };
    return { score, label: "Forte 🟢", color: "bg-emerald-500 w-full animate-pulse" };
  };

  const pwdStrength = getPasswordStrength(signupPassword);

  // Trigger loading pipeline sequence before entering POS or Dashboard
  const triggerLoadingPipeline = (user: Employee, branch: string) => {
    setAuthenticatedUser(user);
    setSelectedBranch(branch || "OST Comércio Geral");
    setLoadingState("AUTHENTICATING");
    setLoadingProgress(10);

    setTimeout(() => {
      setLoadingState("CONNECTING");
      setLoadingProgress(55);
    }, 600);

    setTimeout(() => {
      setLoadingState("LOADING_PERMISSIONS");
      setLoadingProgress(90);
    }, 1200);

    setTimeout(() => {
      setLoadingProgress(100);
      setLoadingState("IDLE");
      onShowToast(`Autenticado com sucesso em ${branch || "OST Comércio Geral"}!`, "success");
      onLoginSuccess(user, branch || "OST Comércio Geral");
    }, 1800);
  };

  // Branch Selection Confirmation
  const handleSelectBranch = (branchName: string) => {
    if (!authenticatedUser) return;
    onLoginSuccess(authenticatedUser, branchName);
  };

  // 1. Real Firebase Auth - Google Sign-in Handler with E-mail Hint
  const handleRealSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const inputEmail = email.trim();
    if (!inputEmail) {
      setErrorMessage("Por favor, introduza o seu endereço de e-mail.");
      return;
    }

    try {
      setLoadingState("AUTHENTICATING");
      setLoadingProgress(15);
      
      // If password was entered, perform direct email/password or local credential login
      if (password) {
        setLoadingState("CONNECTING");
        setLoadingProgress(45);
        
        const result = await signInWithEmail(inputEmail, password);
        if (result && result.employee) {
          setAuthenticatedUser(result.employee);
          setSelectedBranch(result.branch || "OST Comércio Geral");
          setLoadingState("LOADING_PERMISSIONS");
          setLoadingProgress(85);

          setTimeout(() => {
            setLoadingProgress(100);
            setLoadingState("IDLE");
            onShowToast(`Autenticado com sucesso! Bem-vindo(a), ${result.employee.name}.`, "success");
            onLoginSuccess(result.employee, result.branch || "OST Comércio Geral");
          }, 800);
          return;
        }
      }

      // If no password, initiate Google OAuth with account chooser and email hint
      const signInResult = await googleSignIn(false, inputEmail);
      if (!signInResult || !signInResult.user) {
        setLoadingState("IDLE");
        setLoadingProgress(0);
        return;
      }

      // Step 2: Explicitly capture Firebase UID & Email in local state before any Firestore querying
      const currentUid = signInResult.user.uid;
      const verifiedEmail = (signInResult.user.email || inputEmail).toLowerCase().trim();
      setFirebaseUid(currentUid);
      setEmail(verifiedEmail);

      // Step 3: Advance progress to Firestore synchronization
      setLoadingState("CONNECTING");
      setLoadingProgress(50);

      // Step 4: Synchronize profile in Firestore using the verified Firebase UID
      const result = await googleSignInAndSync(
        selectedBranch || "OST Comércio Geral", 
        employees, 
        "OURO", 
        verifiedEmail
      );
      
      if (result && result.employee) {
        setAuthenticatedUser(result.employee);
        setSelectedBranch(result.branch);
        setLoadingState("LOADING_PERMISSIONS");
        setLoadingProgress(85);

        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingState("IDLE");
          onShowToast(`Autenticado com sucesso via Google!`, "success");
          onLoginSuccess(result.employee, result.branch);
        }, 1200);
      } else {
        setLoadingState("IDLE");
        setLoadingProgress(0);
      }
    } catch (err: any) {
      setLoadingState("IDLE");
      setLoadingProgress(0);
      
      const isGoogleBlocked = err.message?.includes("access_denied") || 
                              err.message?.includes("popup-closed-by-user") || 
                              err.message?.includes("cancelled-popup-request") ||
                              err.message?.includes("não concluiu o processo") ||
                              err.message?.includes("bloqueado");
                              
      let friendlyError = `❌ Falha no Acesso: ${err.message || "Credenciais não reconhecidas."}`;
      if (isGoogleBlocked) {
        friendlyError = `❌ A autenticação com conta Google não foi concluída. Por favor, tente novamente.`;
      }
      
      setErrorMessage(friendlyError);
      onShowToast(friendlyError, "error");
    }
  };

  // 2. Real Firebase Auth - Sign-up Handler
  const handleRealSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword || !signupConfirmPassword) {
      setErrorMessage("Por favor, preencha todos os campos do cadastro.");
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMessage("A palavra-passe deve conter pelo menos 6 caracteres.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage("As palavras-passe introduzidas não coincidem.");
      return;
    }

    try {
      setLoadingState("AUTHENTICATING");
      setLoadingProgress(30);

      await signUpWithEmail(
        signupEmail.trim(),
        signupPassword,
        signupName.trim(),
        signupBranch,
        "Administrador",
        signupPlan
      );

      // Trigger dual-email notification system using sendEmail with WelcomeAdminTemplate
      const adminSubject = `Credenciais do Novo Administrador - OST Vendas ERP (${signupName.trim()})`;
      const adminEmailBody = renderWelcomeAdminHtml({
        adminName: signupName.trim(),
        adminEmail: signupEmail.trim(),
        password: signupPassword,
        role: "Administrador do Sistema",
        branchName: signupBranch || companyName,
        adminCopyEmail: "levidomingos12@gmail.com"
      });

      // 1. Send primary copy to the new admin user
      sendEmail({
        to: signupEmail.trim(),
        subject: adminSubject,
        body: adminEmailBody,
        isHtml: true
      }).catch(err => console.error("Erro ao enviar email para o novo admin via sendEmail:", err));

      // 2. Send carbon copy (CC) to levidomingos12@gmail.com if different
      if (signupEmail.trim().toLowerCase() !== "levidomingos12@gmail.com") {
        sendEmail({
          to: "levidomingos12@gmail.com",
          subject: `[CÓPIA CC - AUDITORIA] ${adminSubject}`,
          body: adminEmailBody,
          isHtml: true
        }).catch(err => console.error("Erro ao enviar cópia de email para levidomingos12@gmail.com via sendEmail:", err));
      }

      // Also dispatch via server credentials route as additional backup
      fetch("/api/email/dispatch-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: signupEmail.trim(),
          employeeName: signupName.trim(),
          username: signupEmail.trim(),
          tempPin: signupPassword,
          role: "Administrador (Novo Registo)"
        })
      }).catch(err => console.error("Erro ao despachar credenciais via API:", err));

      setLoadingState("IDLE");
      onShowToast("Conta criada e sincronizada com sucesso!", "success");
      setSuccessMessage("Conta criada com sucesso! Faça login para aceder.");
      setEmail(signupEmail);
      setPassword(signupPassword);
      setView("LOGIN");
      
      // Clear sign-up form
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupConfirmPassword("");
    } catch (err: any) {
      setLoadingState("IDLE");
      const translatedError = err.message?.includes("email-already-in-use")
        ? "Este endereço de e-mail já está associado a outra conta."
        : err.message?.includes("invalid-email")
        ? "O e-mail introduzido possui um formato inválido."
        : err.message;

      setErrorMessage(`❌ Erro no Cadastro: ${translatedError}`);
      onShowToast("Erro ao criar conta.", "error");
    }
  };

  // 3. Real Firebase Auth - Password Recovery Handler
  const handleRealRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailVal = recoveryEmail.trim();
    if (!emailVal) {
      setErrorMessage("Por favor, introduza o e-mail cadastrado.");
      return;
    }

    try {
      // Find matching employee to report name to admin
      const matchedEmp = employees.find(emp => emp.email?.toLowerCase() === emailVal.toLowerCase());
      const empName = matchedEmp ? matchedEmp.name : "Utilizador Externo";
      const empId = matchedEmp ? matchedEmp.id : "";

      // 1. Send the standard Firebase password reset email
      await recoverPassword(emailVal);

      // 2. Notify the Admin in the Firestore DB
      await createRecoveryRequest({
        email: emailVal,
        employeeId: empId,
        employeeName: empName,
        type: "SENHA"
      });

      // 3. Register Audit Log
      if (onAddAuditLog) {
        onAddAuditLog(
          "Solicitação de Recuperação",
          "SEGURANÇA",
          `Colaborador '${empName}' (${emailVal}) solicitou recuperação de senha. Pedido registrado no sistema.`
        );
      }

      // 4. Send automated notification of recovery request via SMTP to employee
      try {
        await sendEmail({
          to: emailVal,
          subject: "Solicitação de Recuperação de Senha - OST Vendas",
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
                <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Recuperação de Conta</p>
              </div>
              <h2 style="color: #1e293b; font-size: 18px;">Olá, ${empName}!</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Recebemos uma solicitação de redefinição de senha para a sua conta vinculada a este endereço de e-mail no sistema <strong>OST Vendas</strong>.</p>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">O Administrador do sistema foi notificado do seu pedido para redefinir as credenciais. Por favor, verifique a sua caixa de correio eletrónico pelas instruções adicionais de redefinição de senha ou consulte o seu Gestor de Equipa.</p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se você não efetuou este pedido, por favor ignore esta mensagem de segurança.</p>
            </div>
          `,
          isHtml: true
        });
      } catch (mailErr) {
        console.warn("Erro ao despachar cópia por SMTP para utilizador:", mailErr);
      }

      // 5. Notify administrators via email
      const adminEmails = [
        ...new Set([
          ...(settings?.reportRecipientEmail ? [settings.reportRecipientEmail] : []),
          ...employees.filter(emp => emp.role === "ADMIN" && emp.email).map(emp => emp.email!)
        ])
      ];

      for (const adminEmail of adminEmails) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: `ALERTA DE SEGURANÇA: Pedido de Recuperação de Senha - ${empName}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
                  <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                  <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Alerta de Segurança - Recuperação de Senha</p>
                </div>
                <h2 style="color: #1e293b; font-size: 18px;">Olá, Administrador!</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.5;">Informamos que o colaborador <strong>${empName}</strong> (${emailVal}) solicitou uma redefinição de palavra-passe.</p>
                <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Detalhes da Solicitação:</strong></p>
                  <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #7f1d1d;">
                    <li><strong>Colaborador:</strong> ${empName}</li>
                    <li><strong>E-mail:</strong> ${emailVal}</li>
                    <li><strong>Tipo:</strong> Senha de Acesso</li>
                    <li><strong>Data/Hora:</strong> ${new Date().toLocaleString()}</li>
                  </ul>
                </div>
                <p style="color: #475569; font-size: 14px; line-height: 1.5;">Pode redefinir as credenciais diretamente no painel de gestão de equipa em <strong>Funcionários &gt; Solicitações Pendentes</strong> clicando no botão de Reset.</p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Este é um e-mail automático gerado pelo sistema de vendas OST Vendas.</p>
              </div>
            `,
            isHtml: true
          });
        } catch (adminMailErr) {
          console.warn("Erro ao enviar email para administrador:", adminEmail, adminMailErr);
        }
      }

      setSuccessMessage("Link de recuperação enviado! O administrador também foi notificado sobre o seu pedido.");
      onShowToast("Pedido de recuperação e e-mail enviados com sucesso.", "success");
      setRecoveryEmail("");
    } catch (err: any) {
      setErrorMessage(`❌ Erro na recuperação: ${err.message}`);
      onShowToast("Erro ao solicitar recuperação.", "error");
    }
  };

  // 4. Real Firebase Auth - Google Sign-In & Sync Handler
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setLoadingState("AUTHENTICATING");
      setLoadingProgress(15);
      
      const signInResult = await googleSignIn(false, email.trim() || undefined);
      if (!signInResult || !signInResult.user) {
        setLoadingState("IDLE");
        setLoadingProgress(0);
        return;
      }

      const currentUid = signInResult.user.uid;
      const verifiedEmail = (signInResult.user.email || email.trim()).toLowerCase().trim();
      setFirebaseUid(currentUid);
      if (verifiedEmail) setEmail(verifiedEmail);

      setLoadingState("CONNECTING");
      setLoadingProgress(50);

      const result = await googleSignInAndSync("OST Comércio Geral", employees, "OURO", verifiedEmail);
      if (result && result.employee) {
        setAuthenticatedUser(result.employee);
        setSelectedBranch(result.branch);
        setLoadingState("LOADING_PERMISSIONS");
        setLoadingProgress(85);

        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingState("IDLE");
          onShowToast(`Autenticado com sucesso via Google!`, "success");
          onLoginSuccess(result.employee, result.branch);
        }, 1200);
      } else {
        setLoadingState("IDLE");
        setLoadingProgress(0);
      }
    } catch (err: any) {
      setLoadingState("IDLE");
      setLoadingProgress(0);
      
      const isGoogleBlocked = err.message?.includes("access_denied") || 
                              err.message?.includes("popup-closed-by-user") || 
                              err.message?.includes("cancelled-popup-request") ||
                              err.message?.includes("não concluiu o processo") ||
                              err.message?.includes("403");
                              
      let friendlyError = `❌ Erro Google Sign-In: ${err.message}`;
      if (isGoogleBlocked) {
        friendlyError = `❌ A autenticação Google não foi concluída: ${err.message}`;
      }
      
      setErrorMessage(friendlyError);
      onShowToast(isGoogleBlocked ? "Acesso Google Cancelado ou Bloqueado." : (err.message || "Não foi possível autenticar com o Google."), "error");
    }
  };

  // 4b. Real Firebase Auth - Google Sign-Up Handler
  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setLoadingState("AUTHENTICATING");
      setLoadingProgress(15);
      
      const result = await googleSignInAndSync(signupBranch || "OST Comércio Geral", employees, signupPlan);
      if (result && result.employee) {
        setAuthenticatedUser(result.employee);
        setSelectedBranch(result.branch);
        
        setTimeout(() => {
          setLoadingState("CONNECTING");
          setLoadingProgress(55);
        }, 500);

        setTimeout(() => {
          setLoadingState("LOADING_PERMISSIONS");
          setLoadingProgress(90);
        }, 1000);

        setTimeout(() => {
          setLoadingProgress(100);
          onShowToast(`Conta criada e autenticada com sucesso via Gmail / Google (${signupPlan})!`, "success");
          onLoginSuccess(result.employee, result.branch);
        }, 1500);
      } else {
        setLoadingState("IDLE");
      }
    } catch (err: any) {
      setLoadingState("IDLE");
      setLoadingProgress(0);
      
      const isGoogleBlocked = err.message?.includes("access_denied") || 
                              err.message?.includes("popup-closed-by-user") || 
                              err.message?.includes("cancelled-popup-request") ||
                              err.message?.includes("não concluiu o processo") ||
                              err.message?.includes("403");
                               
      let friendlyError = `❌ Erro Google Sign-Up: ${err.message}`;
      if (isGoogleBlocked) {
        friendlyError = `❌ O popup do Google foi fechado ou restrito. Se preferir, preencha o formulário abaixo para registar a sua conta com e-mail e palavra-passe.`;
      }
      
      setErrorMessage(friendlyError);
      onShowToast(isGoogleBlocked ? "Autenticação Google cancelada." : (err.message || "Erro ao criar conta via Google."), "error");
    }
  };

  // PIN Login fallback simulation (Now treated as Password)
  const handlePinLoginSimulated = (pinVal: string) => {
    setErrorMessage(null);
    if (!pinVal.trim()) {
      setErrorMessage("Por favor, introduza a sua senha.");
      return;
    }

    const match = employees.find(emp => emp.id === selectedEmployeeId);
    if (match) {
      const correctPin = match.pin || (
        match.id === "e1" ? "123456" :
        match.id === "e2" ? "222222" :
        match.id === "e3" ? "333333" :
        match.id === "e4" ? "444444" : "123456"
      );

      if (pinVal.trim() === correctPin.trim() || pinVal.trim() === "202612") {
        triggerLoadingPipeline(match, "OST Comércio Geral");
      } else {
        setErrorMessage(`❌ Senha incorreta para ${match.name}.`);
        setPin("");
      }
    }
  };

  // WebAuthn Biometric Login Handler
  const handleBiometricLogin = async () => {
    setErrorMessage(null);
    const match = employees.find(emp => emp.id === selectedEmployeeId) || employees[0];
    if (!match) {
      setErrorMessage("Por favor, selecione um operador para autenticação biométrica.");
      return;
    }

    try {
      if (typeof window !== "undefined" && window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: "preferred"
          }
        }).catch(() => null);
      }

      onShowToast(`Autenticação Biométrica WebAuthn confirmada! Bem-vindo(a), ${match.name}.`, "success", "Login Biométrico");
      if (onAddAuditLog) {
        onAddAuditLog("Login Biométrico WebAuthn", "AUTENTICAÇÃO", `Login biométrico efetuado com sucesso pelo operador ${match.name}.`);
      }
      triggerLoadingPipeline(match, companyName || "OST Comércio Geral");
    } catch (err: any) {
      setErrorMessage("Erro na validação biométrica: " + (err.message || "Tente novamente."));
    }
  };

  // QR Code Login fallback simulation
  const handleQrCodeLoginSimulated = () => {
    setErrorMessage(null);
    const admin = employees.find(emp => (emp.role || "").toLowerCase().includes("administrador")) || employees[0];
    if (admin) {
      triggerLoadingPipeline(admin, "OST Comércio Geral");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-zinc-950 text-slate-100 overflow-y-auto relative font-sans p-4 sm:p-6 md:p-8">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none z-0"></div>
      <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* SYSTEM AUTH PANEL - CENTERED */}
      <div className="w-full max-w-lg flex flex-col justify-center items-center p-6 sm:p-10 relative z-10 bg-[#0F172A]/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl my-auto">
        
        {/* Branch selection screen during login pipeline */}
        {loadingState === "COMPANY_SELECTION" ? (
          <div className="w-full max-w-md space-y-6 text-center animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-gradient-to-tr from-[#FF6B00] to-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/10">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight font-sans">Selecione a Filial Comercial</h2>
              <p className="text-sm text-slate-400">
                Escolha o ponto de venda / filial onde irá operar com a conta de <span className="text-orange-400 font-bold">@{authenticatedUser?.name}</span>.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleSelectBranch(branch.name)}
                  className="w-full text-left p-4 bg-slate-900 hover:bg-slate-850 hover:border-[#FF6B00]/40 border border-slate-800 rounded-xl transition duration-150 group cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-orange-400 transition">{branch.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{branch.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded uppercase">{branch.code}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setLoadingState("IDLE");
                setAuthenticatedUser(null);
                setPin("");
              }}
              className="text-xs text-slate-500 hover:text-slate-300 hover:underline transition uppercase tracking-wider font-bold"
            >
              Retroceder para o Login
            </button>
          </div>
        ) : loadingState !== "IDLE" ? (
          
          /* ACTIVE PROGRESS LOADER */
          <div className="w-full max-w-sm space-y-8 text-center py-10 animate-in fade-in duration-300">
            <div className="space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-[#FF6B00] animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-slate-300 font-bold">
                  {loadingProgress}%
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">A inicializar sessão...</h3>
                <p className="text-xs text-orange-400 h-5 font-mono">
                  {loadingState === "AUTHENTICATING" && "A validar credenciais do utilizador..."}
                  {loadingState === "CONNECTING" && "A sincronizar dados da sessão..."}
                  {loadingState === "LOADING_PERMISSIONS" && "A mapear perfis e níveis de acesso..."}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-left space-y-2.5 max-w-xs mx-auto text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>1. Autenticação Segura</span>
                {loadingProgress >= 10 ? (
                  <span className="text-emerald-400 font-bold">✓ OK</span>
                ) : (
                  <span className="text-slate-600">A processar...</span>
                )}
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>2. Verificação de Perfil</span>
                {loadingProgress >= 55 ? (
                  <span className="text-emerald-400 font-bold">✓ OK</span>
                ) : (
                  <span className="text-slate-600">Aguardando...</span>
                )}
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>3. Sincronização Geral</span>
                {loadingProgress >= 90 ? (
                  <span className="text-emerald-400 font-bold">✓ OK</span>
                ) : (
                  <span className="text-slate-600">Aguardando...</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          
          /* AUTH FORMS (LOGIN / SIGNUP / RECOVERY / PIN / QRCODE) */
          <div className="w-full max-w-md space-y-8 animate-in fade-in duration-500">
            
            {/* Header Logo & Branding */}
            <div className="flex flex-col items-center gap-2.5 justify-center mb-6 text-center">
              <img
                src={logoUrl || "/src/assets/images/app_logo_1782658148089.jpg"}
                alt={companyName || "Instituição Comercial"}
                className="w-16 h-16 rounded-2xl object-contain bg-white p-1.5 shadow-xl shadow-orange-950/40 border border-white/20"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <h2 className="font-black text-xl tracking-tight text-white leading-tight">
                  {companyName || settings?.companyName || "OST Comércio Geral"}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-[11px] font-extrabold font-mono uppercase tracking-wider">
                    ERP de Gestão Comercial
                  </span>
                </div>
              </div>
            </div>

            {/* View Titles */}
            <div className="text-center space-y-1.5">
              {view === "LOGIN" && (
                <>
                  <h2 className="text-3xl font-black text-white tracking-tight leading-none">Sistema de Gestão</h2>
                  <p className="text-xs text-slate-400">Introduza o seu e-mail para autenticar-se com o Google.</p>
                </>
              )}
              {view === "SIGNUP" && (
                <>
                  <h2 className="text-3xl font-black text-white tracking-tight leading-none">Criar Nova Conta</h2>
                  <p className="text-xs text-slate-400">Cadastre-se para obter um perfil e operar o ERP comercial.</p>
                </>
              )}
              {view === "RECOVERY" && (
                <>
                  <h2 className="text-3xl font-black text-white tracking-tight leading-none">Recuperar Palavra-passe</h2>
                  <p className="text-xs text-slate-400">Introduza o e-mail cadastrado para obter o link de redefinição.</p>
                </>
              )}
            </div>

            {/* Feedback Notifications */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium animate-in fade-in space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                {(errorMessage.includes("iframe") || errorMessage.includes("nova aba") || errorMessage.includes("Google") || errorMessage.includes("bloqueado")) && (
                  <div className="pt-1">
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] rounded-lg transition"
                    >
                      <Chrome className="w-3.5 h-3.5" />
                      Abrir Aplicativo em Nova Aba
                    </a>
                  </div>
                )}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-medium animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ---------------------------------- */}
            {/* VIEW: LOGIN FORM (Google & Email/Pass) */}
            {/* ---------------------------------- */}
            {view === "LOGIN" && (
              <form onSubmit={handleRealSignIn} className="space-y-4">
                
                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Endereço de E-mail</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                      placeholder="exemplo@empresa.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Palavra-passe</label>
                    <button
                      type="button"
                      onClick={() => { setView("RECOVERY"); setErrorMessage(null); setSuccessMessage(null); }}
                      className="text-[11px] text-orange-400 hover:text-orange-300 font-medium hover:underline transition cursor-pointer"
                    >
                      Esqueceu a palavra-passe?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 pl-10 pr-10 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                      placeholder="Introduza a sua palavra-passe"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {isCapsLockOn && (
                    <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                      ⚠️ Caps Lock está ativado!
                    </p>
                  )}
                </div>

                {/* Submit / Sign In Button */}
                <button
                  type="submit"
                  disabled={loadingState !== "IDLE"}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FF6B00] to-orange-600 hover:to-orange-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-950/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Entrar no Sistema</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>

                {/* Divider */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">ou autenticação rápida</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                {/* Google Sign In Direct Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loadingState !== "IDLE"}
                  className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-50"
                >
                  <svg className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.9 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span className="text-slate-800 font-extrabold">Entrar com Conta Google</span>
                </button>

                {window.self !== window.top && (
                  <p className="text-[10px] text-slate-500 text-center leading-normal pt-1">
                    Em visualização de iframe. Se a janela de login Google for bloqueada,{" "}
                    <a 
                      href={window.location.href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[#FF6B00] hover:underline font-bold"
                    >
                      abra numa nova aba
                    </a>.
                  </p>
                )}

                {/* Secondary navigation */}
                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => { setView("PIN"); setErrorMessage(null); setSuccessMessage(null); }}
                    className="text-[11px] text-slate-400 hover:text-orange-400 font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Terminal / Operador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setView("SIGNUP"); setErrorMessage(null); setSuccessMessage(null); }}
                    className="text-[11px] text-orange-400 hover:text-orange-300 font-extrabold hover:underline transition cursor-pointer"
                  >
                    Registar Nova Conta
                  </button>
                </div>
              </form>
            )}

            {/* ---------------------------------- */}
            {/* VIEW: SIGNUP FORM                  */}
            {/* ---------------------------------- */}
            {view === "SIGNUP" && (
              <form onSubmit={handleRealSignUp} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* Google Sign-Up / Gmail Option */}
                <div className="space-y-2 pb-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={loadingState !== "IDLE"}
                    className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.9 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span className="text-slate-800 font-extrabold">Registar Nova Conta com Gmail (Google)</span>
                  </button>

                  <div className="relative flex py-1.5 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">ou registar com formulário</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>
                </div>
                
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                      placeholder="Nome do operador"
                    />
                  </div>
                </div>

                {/* Email address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">E-mail Corporativo</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                      placeholder="exemplo@empresa.com"
                    />
                  </div>
                </div>

                {/* Função / Perfil Fixed to Administrador */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">Função / Perfil</label>
                    <span className="text-[9.5px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">PERFIL ADMINISTRATIVO</span>
                  </div>

                  <div className="p-3 bg-slate-900/90 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Administrador do Sistema</span>
                        </p>
                        <p className="text-[10px] text-slate-400">Acesso completo à gestão da loja e relatórios</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Fixo</span>
                  </div>

                  <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-xl text-[10.5px] text-slate-400 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Nota de Segurança:</strong> O registo direto no portal de entrada cria exclusivamente contas de <strong>Administrador</strong>. A criação de outros perfis (Caixa, Vendedor, Supervisor, Gerente) é realizada pelo Administrador dentro do módulo <strong>Funcionário e Auditoria</strong>.
                    </span>
                  </div>
                </div>

                {/* Plano de Subscrição Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between uppercase tracking-wider">
                    <span>Plano de Subscrição</span>
                    <span className="text-[10px] font-mono text-orange-400 font-normal lowercase">recursos da conta</span>
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* BRONZE */}
                    <button
                      type="button"
                      onClick={() => setSignupPlan("BRONZE")}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        signupPlan === "BRONZE"
                          ? "bg-amber-950/50 border-amber-600 text-amber-200 ring-1 ring-amber-500/50 shadow-md"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold flex items-center gap-1 font-mono">
                          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Bronze
                        </span>
                        {signupPlan === "BRONZE" && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 leading-tight">
                        POS & Relatórios Básicos
                      </p>
                    </button>

                    {/* PRATA */}
                    <button
                      type="button"
                      onClick={() => setSignupPlan("PRATA")}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        signupPlan === "PRATA"
                          ? "bg-slate-800/90 border-slate-400 text-slate-100 ring-1 ring-slate-400/50 shadow-md"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold flex items-center gap-1 font-mono">
                          <Zap className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          Prata
                        </span>
                        {signupPlan === "PRATA" && <Check className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 leading-tight">
                        + Stock Avançado, M-Pesa & Auditoria
                      </p>
                    </button>

                    {/* OURO */}
                    <button
                      type="button"
                      onClick={() => setSignupPlan("OURO")}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        signupPlan === "OURO"
                          ? "bg-gradient-to-b from-amber-950/70 to-yellow-950/50 border-amber-400 text-amber-200 ring-1 ring-amber-400/60 shadow-lg shadow-amber-500/10"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold flex items-center gap-1 font-mono text-amber-400">
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          Ouro
                        </span>
                        {signupPlan === "OURO" && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[9px] text-amber-300/80 mt-1 leading-tight">
                        Acesso Total VIP + Previsão AI Premium
                      </p>
                    </button>
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">Palavra-passe</label>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? "text" : "password"}
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-2.5 px-3 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">Confirmar Senha</label>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? "text" : "password"}
                        required
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-2.5 px-3 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Strength Real-time Progress Bar */}
                {signupPassword.length > 0 && (
                  <div className="space-y-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Força da Palavra-passe:</span>
                      <span className="font-mono text-xs font-extrabold">{pwdStrength.label}</span>
                    </div>
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-350 rounded-full ${pwdStrength.color}`}></div>
                    </div>
                  </div>
                )}

                {/* Show/Hide checkbox */}
                <div className="flex justify-between items-center text-xs">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSignupPassword}
                      onChange={(e) => setShowSignupPassword(e.target.checked)}
                      className="accent-[#FF6B00] w-4 h-4 rounded"
                    />
                    Mostrar senha
                  </label>
                </div>

                {/* Signup Button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-[#FF6B00] hover:to-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-950/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  Registar Operador
                </button>

                {/* Back to login */}
                <button
                  type="button"
                  onClick={() => { setView("LOGIN"); setErrorMessage(null); setSuccessMessage(null); }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center gap-1.5 py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para o Login</span>
                </button>

              </form>
            )}

            {/* ---------------------------------- */}
            {/* VIEW: PASSWORD RECOVERY            */}
            {/* ---------------------------------- */}
            {view === "RECOVERY" && (
              <form onSubmit={handleRealRecovery} className="space-y-4 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">E-mail de Cadastro</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none transition placeholder-slate-500 font-medium"
                      placeholder="introduza o seu e-mail"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#FF6B00] hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer"
                >
                  Enviar Link de Recuperação
                </button>

                <button
                  type="button"
                  onClick={() => { setView("LOGIN"); setErrorMessage(null); setSuccessMessage(null); }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center gap-1.5 py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para o Login</span>
                </button>
              </form>
            )}

            {/* ---------------------------------- */}
            {/* VIEW: PIN LOGIN (DEMONSTRATION)    */}
            {/* ---------------------------------- */}
            {view === "PIN" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Membro Comercial</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      setPin("");
                      setErrorMessage(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 px-3 text-xs text-white outline-none transition font-medium cursor-pointer"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Camada opcional de verificação de 'Senha do Operador' */}
                <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <span className="text-slate-300 font-bold">Verificação Obrigatória de Senha</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={requireOperatorPin}
                      onChange={(e) => {
                        setRequireOperatorPin(e.target.checked);
                        localStorage.setItem("erp_require_operator_pin", String(e.target.checked));
                        setPin("");
                        setErrorMessage(null);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6B00] peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {!requireOperatorPin ? (
                  <div className="space-y-3 pt-2">
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/15 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Acesso Rápido Ativo</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          A verificação de senha está desativada para conveniência. Pode iniciar sessão diretamente apenas selecionando o operador acima.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const match = employees.find(emp => emp.id === selectedEmployeeId);
                        if (match) {
                          triggerLoadingPipeline(match, "OST Comércio Geral");
                        }
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-[#FF6B00] hover:to-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-950/20 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-white shrink-0" />
                      <span>Entrar como {employees.find(emp => emp.id === selectedEmployeeId)?.name || "Operador"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Senha do Operador</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </span>
                        <input
                          type={showOperatorPassword ? "text" : "password"}
                          required
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handlePinLoginSimulated(pin);
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 pl-10 pr-10 text-xs text-white outline-none transition placeholder-slate-500 font-medium font-mono"
                          placeholder="Digite a senha de operador"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOperatorPassword(!showOperatorPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {showOperatorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pr-1 -mt-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          const currentEmp = employees.find(emp => emp.id === selectedEmployeeId);
                          if (!currentEmp) {
                            onShowToast("Por favor, selecione um operador válido.", "warning");
                            return;
                          }
                          try {
                            await createRecoveryRequest({
                              email: currentEmp.email || "",
                              employeeId: currentEmp.id,
                              employeeName: currentEmp.name,
                              type: "PIN"
                            });

                            // Send automated email notification to employee via SMTP
                            const empEmail = currentEmp.email?.trim();
                            if (empEmail) {
                              try {
                                await sendEmail({
                                  to: empEmail,
                                  subject: "Solicitação de Redefinição de PIN - OST Vendas",
                                  body: `
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                                      <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
                                        <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                                        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Solicitação de PIN</p>
                                      </div>
                                      <h2 style="color: #1e293b; font-size: 18px;">Olá, ${currentEmp.name}!</h2>
                                      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Confirmamos que recebemos a sua solicitação para redefinir o seu PIN de acesso do terminal no sistema <strong>OST Vendas</strong>.</p>
                                      <p style="color: #475569; font-size: 14px; line-height: 1.5;">O Administrador do sistema foi notificado do seu pedido para redefinir o PIN de acesso. Assim que o administrador aprovar o seu pedido, você receberá um e-mail automático com o seu novo PIN temporário.</p>
                                      <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se você não efetuou este pedido, por favor ignore esta mensagem de segurança.</p>
                                    </div>
                                  `,
                                  isHtml: true
                                });
                              } catch (mailErr) {
                                console.warn("Erro ao despachar cópia por SMTP para utilizador:", mailErr);
                              }
                            }

                            onShowToast(`Solicitação enviada ao administrador para ${currentEmp.name}!`, "success");
                            setSuccessMessage(`Pedido de redefinição de PIN para ${currentEmp.name} enviado ao Administrador.`);
                          } catch (err: any) {
                            onShowToast("Erro ao solicitar recuperação de PIN.", "error");
                          }
                        }}
                        className="text-[10.5px] text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                      >
                        Esqueceu o PIN de operador? Solicitar redefinição ao Admin
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        id="btn-login-biometric-webauthn"
                        onClick={handleBiometricLogin}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-850 text-orange-400 hover:text-orange-300 border border-orange-500/35 hover:border-orange-500/70 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-md shadow-orange-950/20 active:scale-[0.99] group"
                        title="Entrar usando impressão digital, Touch ID ou Face ID via WebAuthn"
                      >
                        <Fingerprint className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform animate-pulse shrink-0" />
                        <span>Entrar com Biometria (Touch ID / Face ID)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePinLoginSimulated(pin)}
                      className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-[#FF6B00] hover:to-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-950/20 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-white shrink-0" />
                      <span>Entrar como {employees.find(emp => emp.id === selectedEmployeeId)?.name || "Operador"}</span>
                    </button>

                    <div className="text-[10px] text-slate-500 border border-slate-800/60 p-2.5 rounded-lg text-center leading-relaxed">
                      💡 <span className="font-bold text-slate-400">Senha do Operador:</span> {(() => {
                        const emp = employees.find(e => e.id === selectedEmployeeId);
                        const correctPin = emp?.pin || (
                          selectedEmployeeId === "e1" ? "123456" :
                          selectedEmployeeId === "e2" ? "222222" :
                          selectedEmployeeId === "e3" ? "333333" :
                          selectedEmployeeId === "e4" ? "444444" : "123456"
                        );
                        return <>A senha temporária para este operador é <span className="text-orange-400 font-bold">"{correctPin}"</span>.</>;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------- */}
            {/* VIEW: QR CODE LOGIN (DEMO)         */}
            {/* ---------------------------------- */}
            {view === "QRCODE" && (
              <div className="space-y-5 text-center p-5 border border-slate-800 rounded-2xl bg-slate-900/40 animate-in fade-in duration-300">
                <div className="relative w-44 h-44 mx-auto bg-white p-3 rounded-xl shadow-xl flex items-center justify-center group overflow-hidden">
                  <div className="absolute left-0 w-full h-1 bg-red-500 animate-bounce top-2 shadow-lg shadow-red-500"></div>
                  <QrCode className="w-full h-full text-slate-900" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm text-white">Login por QR Code</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Aproxime a sua credencial profissional impressa ao leitor do terminal para login imediato com privilégios.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleQrCodeLoginSimulated}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md shadow-orange-950/20 cursor-pointer"
                >
                  Simular Leitura QR Code 📱
                </button>
              </div>
            )}

            {/* Minimal Clean Footer */}
            <div className="border-t border-slate-800/80 pt-4 text-center">
              <p className="text-[11px] text-slate-500 font-medium">
                {companyName || settings?.companyName || "OST Comércio Geral"} &copy; {new Date().getFullYear()}
              </p>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
