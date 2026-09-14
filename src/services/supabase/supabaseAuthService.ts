/**
 * @file supabaseAuthService.ts
 * Autenticação, gestão de sessão e sincronização de perfis com o Supabase Auth.
 */

import { Session, User } from "@supabase/supabase-js";
import { Employee, SubscriptionPlan, UserRole } from "../../types";
import { 
  getSupabaseClient, 
  getSupabaseConfig, 
  saveSupabaseConfig 
} from "./supabaseConfigService";

export const SupabaseAuthService = {
  // --- AUTENTICAÇÃO SUPABASE COM VALIDAÇÃO ESTRITA DE SEGURANÇA ---
  async signUpWithEmail(email: string, password: string, name: string, branch: string, role: string, plan: string = "OURO") {
    const client = getSupabaseClient();
    if (!client) {
      return { user: null, error: new Error("Servidor de autenticação Supabase não está configurado.") };
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            branch: branch.trim(),
            role,
            subscription_plan: plan
          }
        }
      });

      if (error) {
        console.warn("[Supabase Auth] Erro no signUp:", error.message);
        return { user: null, error };
      }

      if (data && data.user) {
        try {
          const tenantId = getSupabaseConfig().tenantId;
          const empRecord = {
            id: `emp_${data.user.id.slice(0, 8)}`,
            tenant_id: tenantId,
            auth_uid: data.user.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            status: "ACTIVE",
            branch: branch.trim(),
            subscription_plan: plan,
            created_at: new Date().toISOString()
          };
          await client.from("colaboradores").upsert(empRecord, { onConflict: "email" });
        } catch (colabErr) {
          console.warn("[Supabase Auth] Aviso ao sincronizar colaborador:", colabErr);
        }
      }

      return data;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Supabase Auth] Exceção no signUpWithEmail:", errMsg);
      return { user: null, error: err };
    }
  },

  async signInWithEmail(email: string, password: string) {
    const client = getSupabaseClient();
    if (!client) {
      return { user: null, error: new Error("Servidor de autenticação Supabase não está configurado.") };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        console.warn("[Supabase Auth] Falha no signInWithPassword:", error.message);
        return { user: null, error };
      }
      return data;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Supabase Auth] Exceção no signInWithEmail:", errMsg);
      return { user: null, error: err };
    }
  },

  async signInWithGoogle(options?: { popup?: boolean }) {
    const client = getSupabaseClient();
    if (!client) {
      return { url: null, error: new Error("Cliente Supabase não configurado.") };
    }

    try {
      const redirectUri = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
      const isIframe = typeof window !== "undefined" && window.self !== window.top;

      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "select_account"
          },
          skipBrowserRedirect: isIframe
        }
      });

      if (error) {
        console.warn("[Supabase Auth] Erro no signInWithOAuth Google:", error.message);
        return { data: null, error, url: null };
      }

      if (data?.url && typeof window !== "undefined") {
        if (isIframe) {
          const popup = window.open(
            data.url,
            "google_oauth_popup",
            "width=550,height=650,left=250,top=100,status=no,resizable=yes"
          );
          if (!popup || popup.closed || typeof popup.closed === "undefined") {
            if (window.top) {
              window.top.location.href = data.url;
            } else {
              window.location.assign(data.url);
            }
          }
        } else {
          window.location.assign(data.url);
        }
      }

      return { data, error: null, url: data?.url || null };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Supabase Auth] Exceção no signInWithOAuth Google:", errMsg);
      return { data: null, error: err, url: null };
    }
  },

  async recoverPassword(email: string) {
    const client = getSupabaseClient();
    if (!client) return { data: null, error: null };

    try {
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        console.warn("[Supabase Auth] Aviso no resetPasswordForEmail:", error.message);
      }
      return data;
    } catch (err) {
      console.warn("[Supabase Auth] Exceção no resetPasswordForEmail:", err);
      return null;
    }
  },

  async signOut() {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  },

  /**
   * Utilitário de Integridade de Dados: Mescla listas de entidades preservando registros locais e remotos por ID
   */
  mergeRecordsById<T extends { id: string; updatedAt?: string; updated_at?: string }>(localList: T[] = [], remoteList: T[] = []): T[] {
    const map = new Map<string, T>();
    
    // Primeiro insere os registros locais
    for (const item of localList) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
    
    // Em seguida mescla com os registros remotos (atualizando se o remoto for mais recente ou complementar)
    for (const remote of remoteList) {
      if (remote && remote.id) {
        const local = map.get(remote.id);
        if (!local) {
          map.set(remote.id, remote);
        } else {
          // Merge inteligente: verifica timestamps para não sobrescrever mutações locais mais recentes
          const localObj = local as Record<string, unknown>;
          const remoteObj = remote as Record<string, unknown>;

          const localTime = new Date(String(localObj.updatedAt || localObj.updated_at || "")).getTime();
          const remoteTime = new Date(String(remoteObj.updatedAt || remoteObj.updated_at || "")).getTime();

          const isLocalNewer = !isNaN(localTime) && (isNaN(remoteTime) || localTime > remoteTime);

          if (isLocalNewer) {
            // Local é mais recente! Mantém local como autoritário, apenas complementa dados faltantes do remoto
            map.set(remote.id, {
              ...remote,
              ...local,
              ...(localObj.pin && !remoteObj.pin ? { pin: localObj.pin } : {}),
              ...(localObj.password && !remoteObj.password ? { password: localObj.password } : {}),
              ...(localObj.image && !remoteObj.image ? { image: localObj.image } : {}),
              ...(localObj.emoji && !remoteObj.emoji ? { emoji: localObj.emoji } : {}),
              ...(localObj.barcode && !remoteObj.barcode ? { barcode: localObj.barcode } : {})
            });
          } else {
            // Remoto é mais recente ou igual
            map.set(remote.id, {
              ...local,
              ...remote,
              // Preserva chaves locais sensíveis se o remoto vier em branco
              ...(localObj.pin && !remoteObj.pin ? { pin: localObj.pin } : {}),
              ...(localObj.password && !remoteObj.password ? { password: localObj.password } : {}),
              ...(localObj.image && !remoteObj.image ? { image: localObj.image } : {}),
              ...(localObj.emoji && !remoteObj.emoji ? { emoji: localObj.emoji } : {}),
              ...(localObj.barcode && !remoteObj.barcode ? { barcode: localObj.barcode } : {}),
              ...(Number(localObj.salePrice) > 0 && !Number(remoteObj.salePrice) ? { salePrice: localObj.salePrice } : {}),
              ...(Number(localObj.costPrice) > 0 && !Number(remoteObj.costPrice) ? { costPrice: localObj.costPrice } : {})
            });
          }
        }
      }
    }
    
    return Array.from(map.values());
  },

  /**
   * Sincroniza e Mapeia o Utilizador Autenticado (via Google Provider ou Email)
   * com verificação estrita de integridade de dados para evitar sobrescrita de perfis locais existentes.
   */
  async syncUserProfileFromAuth(user: User, localEmployees: Employee[] = []): Promise<{ employee: Employee; companyId: string; companyName: string }> {
    const client = getSupabaseClient();
    const uid = user.id;
    const email = (user.email || "").toLowerCase().trim();
    const meta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    const fullName = meta.full_name || meta.name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    const avatarUrl = meta.avatar_url || meta.picture || "";
    const phone = meta.phone || meta.contact || "+258 84 000 0000";
    const defaultCompanyName = meta.company_name || meta.branch || "";
    
    // Verificar se já existe colaborador local com este email ou ID correspondente para preservar PIN e configurações
    const localMatch = localEmployees.find(e => 
      (e.email && e.email.toLowerCase().trim() === email) ||
      e.id === "emp_" + uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) ||
      (e.username && e.username.toLowerCase() === email.split("@")[0].toLowerCase())
    );

    let role: string = localMatch?.role || (appMeta.role as string) || (meta.role as string) || "";
    let companyId = "comp_" + uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    let companyName = defaultCompanyName || (localMatch?.companyId && !localMatch.companyId.startsWith("comp_") ? localMatch.companyId : "");
    let status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED" = localMatch?.status || "ACTIVE";
    let subscriptionPlan: SubscriptionPlan = (localMatch?.subscriptionPlan || meta.subscription_plan || "OURO") as SubscriptionPlan;
    let existingEmpId = localMatch?.id || "emp_" + uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    let pin = localMatch?.pin || "";
    let pinChanged = localMatch?.pinChanged ?? true;
    let pinCreatedAt = localMatch?.pinCreatedAt || new Date().toISOString();
    let fotoPerfil = localMatch?.fotoPerfil || avatarUrl;

    if (client) {
      try {
        // 1. Verificar se este email já foi pré-cadastrado como colaborador por um Administrador
        const { data: existingColab } = await client
          .from("colaboradores")
          .select("*")
          .or(`auth_uid.eq.${uid},email.eq.${email}`)
          .maybeSingle();

        if (existingColab) {
          if (existingColab.id) existingEmpId = existingColab.id;
          if (existingColab.tenant_id) companyId = existingColab.tenant_id;
          if (existingColab.role) role = existingColab.role as UserRole;
          if (existingColab.status) status = existingColab.status as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
          if (existingColab.branch) companyName = existingColab.branch;
          if (existingColab.subscription_plan) subscriptionPlan = existingColab.subscription_plan;
          if (existingColab.foto_perfil) fotoPerfil = existingColab.foto_perfil;
          if (existingColab.pin) pin = existingColab.pin;

          // Vincular auth_uid se ainda não estava vinculado
          if (!existingColab.auth_uid || existingColab.auth_uid !== uid) {
            await client
              .from("colaboradores")
              .update({ auth_uid: uid, updated_at: new Date().toISOString() })
              .eq("id", existingColab.id);
          }
        }

        // 2. Procurar perfil na tabela 'profiles'
        const { data: profile } = await client
          .from("profiles")
          .select("*, companies(*)")
          .eq("id", uid)
          .maybeSingle();

        if (profile) {
          if (profile.company_id) companyId = profile.company_id;
          if (profile.role && !existingColab) role = profile.role as UserRole;
          if (profile.companies && profile.companies.name) {
            companyName = profile.companies.name;
          }
        } else if (!existingColab) {
          // 3. Verificar se já existe empresa criada para este owner_uid
          const { data: existingComp } = await client
            .from("companies")
            .select("*")
            .eq("owner_uid", uid)
            .maybeSingle();

          if (existingComp) {
            companyId = existingComp.id;
            companyName = existingComp.name;
          } else {
            // Criar nova empresa para este novo proprietário (provisionamento inicial controlado)
            const { data: newComp } = await client
              .from("companies")
              .upsert({
                id: companyId,
                name: companyName,
                owner_uid: uid,
                email: email,
                phone: phone,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .maybeSingle();

            if (newComp && newComp.id) {
              companyId = newComp.id;
            }
          }

          // ADMIN é atribuído estritamente durante o provisionamento controlado do proprietário inicial
          if (!role) {
            role = "ADMIN";
          }

          // Inserir ou atualizar na tabela profiles
          await client.from("profiles").upsert({
            id: uid,
            company_id: companyId,
            email: email,
            full_name: fullName,
            role: role,
            avatar_url: fotoPerfil,
            phone: phone,
            updated_at: new Date().toISOString()
          });

          // Inserir na tabela colaboradores como Administrador da Empresa
          await client.from("colaboradores").upsert({
            id: existingEmpId,
            tenant_id: companyId,
            auth_uid: uid,
            name: fullName,
            email: email,
            role: role,
            contact: phone,
            salary: localMatch?.salary || 0,
            admission_date: localMatch?.admissionDate || new Date().toISOString().split("T")[0],
            status: status,
            branch: companyName,
            subscription_plan: subscriptionPlan,
            foto_perfil: fotoPerfil,
            pin: pin,
            updated_at: new Date().toISOString()
          }, { onConflict: "id" });
        }

        // 4. Configurar tenant_id do Supabase Service para isolamento estrito
        saveSupabaseConfig({ tenantId: companyId });
        if (typeof window !== "undefined") {
          localStorage.setItem("erp_current_tenant_id", companyId);
        }

      } catch (dbErr) {
        console.warn("[Supabase Sync Profile] Falha ao sincronizar perfil:", dbErr);
      }
    }

    if (typeof window !== "undefined" && companyId) {
      localStorage.setItem("erp_current_tenant_id", companyId);
    }

    const employee: Employee = {
      id: existingEmpId,
      name: localMatch?.name || fullName,
      email: email,
      role: role,
      contact: localMatch?.contact || phone,
      salary: localMatch?.salary || 0,
      admissionDate: localMatch?.admissionDate || new Date().toISOString().split("T")[0],
      status: status,
      username: localMatch?.username || email.split("@")[0],
      pin: pin,
      pinCreatedAt: pinCreatedAt,
      pinChanged: pinChanged,
      companyId: companyName || "OST Vendas",
      tenantId: companyId,
      subscriptionPlan: subscriptionPlan,
      fotoPerfil: fotoPerfil,
      theme: localMatch?.theme
    };

    return { employee, companyId, companyName };
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const client = getSupabaseClient();
    if (!client) return { unsubscribe: () => {} };

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return {
      unsubscribe: () => subscription.unsubscribe()
    };
  }
};
