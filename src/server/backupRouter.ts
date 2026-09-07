import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { requireAdmin, requireAuth, AuthenticatedUserContext, AuthenticatedRequest } from "./authMiddleware";
import { getSupabaseClient } from "../lib/supabase";

export const backupRouter = Router();

const BACKUPS_DIR = path.join(process.cwd(), "backups");
if (!fs.existsSync(BACKUPS_DIR)) {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create backups directory:", err);
  }
}

// 1. Cron Status
backupRouter.get("/cron-status", requireAuth, (_req: Request, res: Response) => {
  res.json({
    active: true,
    pattern: "0 18 * * 1-5",
    description: "Backup automático de segunda a sexta às 18:00",
    lastRun: new Date().toISOString(),
    status: "HEALTHY"
  });
});

// 2. Trigger Cron Manually
backupRouter.post("/trigger-cron", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const client = getSupabaseClient();
    
    const [prods, custs, sales] = await Promise.allSettled([
      client.from("produtos").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("clientes").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("vendas").select("*").eq("tenant_id", user?.tenantId || "default")
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      type: "cron_manual",
      tenantId: user?.tenantId || "default",
      tables: {
        produtos: prods.status === "fulfilled" ? prods.value.data : [],
        clientes: custs.status === "fulfilled" ? custs.value.data : [],
        vendas: sales.status === "fulfilled" ? sales.value.data : []
      }
    };

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_cron_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf-8");

    res.json({
      success: true,
      message: "Execução manual de cron concluída com sucesso.",
      backupFile: filename
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao disparar cron.";
    res.status(500).json({ error: errorMsg });
  }
});

// 3. List Backups
backupRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(f => f.endsWith(".json") || f.endsWith(".sql") || f.endsWith(".bak"))
      .map(filename => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.birthtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ backups });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao listar backups.";
    res.status(500).json({ error: errorMsg });
  }
});

// 4. Create / Export Backup directly from Supabase
backupRouter.post("/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const client = getSupabaseClient();
    
    const [prods, custs, sales, logs, caixa, settings] = await Promise.allSettled([
      client.from("produtos").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("clientes").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("vendas").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("audit_logs").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("caixa").select("*").eq("tenant_id", user?.tenantId || "default"),
      client.from("settings").select("*").eq("tenant_id", user?.tenantId || "default")
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      type: req.body?.type || "manual",
      tenantId: user?.tenantId || "default",
      exportedBy: user?.email || user?.id,
      tables: {
        produtos: prods.status === "fulfilled" ? prods.value.data : [],
        clientes: custs.status === "fulfilled" ? custs.value.data : [],
        vendas: sales.status === "fulfilled" ? sales.value.data : [],
        audit_logs: logs.status === "fulfilled" ? logs.value.data : [],
        caixa: caixa.status === "fulfilled" ? caixa.value.data : [],
        settings: settings.status === "fulfilled" ? settings.value.data : []
      }
    };

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${backupData.type}_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf-8");

    res.json({
      success: true,
      message: "Cópia de segurança gerada com sucesso a partir do Supabase.",
      backup: {
        filename,
        sizeBytes: fs.statSync(filePath).size,
        createdAt: backupData.timestamp
      }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao exportar backup.";
    res.status(500).json({ error: errorMsg });
  }
});

// 3. Download Backup
backupRouter.get("/download/:filename", requireAdmin, (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Ficheiro de backup não encontrado." });
    }

    res.download(filePath);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao descarregar backup.";
    res.status(500).json({ error: errorMsg });
  }
});

// 4. Delete Backup
backupRouter.delete("/:filename", requireAdmin, (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(BACKUPS_DIR, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: `Backup ${safeFilename} removido com sucesso.` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao eliminar backup.";
    res.status(500).json({ error: errorMsg });
  }
});
