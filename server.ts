import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
// Some environments might need default or named import for bcryptjs
const hashPassword = (password: string) => bcrypt.hash(password, 10);
const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);
import { PrismaClient, Role } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// Login Throttling Config
const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes

async function startServer() {
  const app = express();
  app.use(express.json());

  // Middleware Audit Log (single, flexible helper)
  // Usage:
  //  - createAuditLog(userId, action, details?)
  //  - createAuditLog(req, userId, action, details?) -> captures IP and User-Agent
  const createAuditLog = async (reqOrUserId: any, a?: any, b?: any, c?: any) => {
    try {
      // Detect signature by checking first arg
      if (reqOrUserId && typeof reqOrUserId === 'object' && reqOrUserId.headers) {
        const req = reqOrUserId as any;
        const userId = a as string | null;
        const action = b as string;
        const details = c as string | undefined;
        const ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null;
        const ua = req.headers['user-agent'] || null;
        const composed = ((details || '') + (ua ? `\nUA: ${ua}` : '')).trim() || null;
        const auditData: any = {};
        auditData.userId = userId;
        auditData.action = action;
        auditData.details = composed;
        auditData.ipAddress = ip;
        await prisma.auditLog.create({ data: auditData });
      } else {
        const userId = reqOrUserId as string | null;
        const action = a as string;
        const details = b as string | undefined;
        const auditData: any = {};
        auditData.userId = userId;
        auditData.action = action;
        auditData.details = details;
        await prisma.auditLog.create({ data: auditData });
      }
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  };

  // Backwards-compatible alias used in some call sites
  const createAuditLogFromReq = createAuditLog;

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", async (req, res) => {
    try {
      const userCount = await prisma.user.count();
      res.json({ status: "ok", database: "connected", userCount });
    } catch (err: any) {
      console.error("Health check failed:", err);
      res.status(500).json({ status: "error", error: err.message });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { nis, password } = req.body;
    const now = Date.now();

    // Check Throttling
    const attemptData = loginAttempts.get(nis);
    if (attemptData && attemptData.blockedUntil > now) {
      const waitMinutes = Math.ceil((attemptData.blockedUntil - now) / 60000);
      return res.status(429).json({ 
        error: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${waitMinutes} menit.` 
      });
    }

    console.log(`Login attempt for NIS: ${nis}`);
    try {
      const user = await prisma.user.findUnique({ where: { nis } });
      
      const handleFailure = () => {
        let data = loginAttempts.get(nis) || { count: 0, lastAttempt: now, blockedUntil: 0 };
        
        // If last attempt was more than WINDOW_MS ago, reset count
        if (now - data.lastAttempt > WINDOW_MS) {
          data.count = 1;
        } else {
          data.count++;
        }

        data.lastAttempt = now;
        if (data.count >= MAX_ATTEMPTS) {
          data.blockedUntil = now + BLOCK_MS;
          console.log(`NIS ${nis} blocked until ${new Date(data.blockedUntil).toISOString()}`);
        }
        loginAttempts.set(nis, data);
      };

      if (!user) {
        console.log(`User not found for NIS: ${nis}`);
        handleFailure();
        return res.status(401).json({ error: "Kredensial tidak valid (NIS tidak ditemukan)" });
      }

      if (user.status === "INACTIVE") {
        return res.status(403).json({ error: "Akun Anda dinonaktifkan oleh admin." });
      }
      
      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        console.log(`Password mismatch for NIS: ${nis}`);
        handleFailure();
        return res.status(401).json({ error: "Kredensial tidak valid (Password salah)" });
      }

      // Success
      loginAttempts.delete(nis);
      
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      await createAuditLogFromReq(req, user.id, "LOGIN", `User ${user.name} logged in`);

      console.log(`Login successful for user: ${user.name}`);
      res.json({ token, user: { id: user.id, name: user.name, nis: user.nis, role: user.role } });
    } catch (err: any) {
      console.error("Critical Login Error:", err);
      res.status(500).json({ error: "Server error: " + err.message });
    }
  });

  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    const { nis, name, password } = req.body;
    
    // Server-side validation
    if (!nis || !/^\d{7,10}$/.test(nis)) {
      return res.status(400).json({ error: "NIS harus berupa 7-10 digit angka" });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Nama lengkap terlalu pendek" });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password minimal 4 karakter" });
    }

    try {
      const existing = await prisma.user.findUnique({ where: { nis } });
      if (existing) return res.status(400).json({ error: "NIS sudah terdaftar" });

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: { nis, name, password: hashedPassword, role: Role.STUDENT }
      });

      await createAuditLogFromReq(req, user.id, "REGISTER", `New student registered: ${name}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Update Profile
  app.put("/api/profile", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { name, currentPassword, newPassword } = req.body;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const updateData: any = {};
      if (name) {
        if (name.trim().length < 2) return res.status(400).json({ error: "Nama terlalu pendek" });
        updateData.name = name;
      }

      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: "Password saat ini diperlukan untuk merubah password" });
        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: "Password saat ini salah" });
        
        if (newPassword.length < 4) return res.status(400).json({ error: "Password baru minimal 4 karakter" });
        updateData.password = await hashPassword(newPassword);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Tidak ada data yang dirubah" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await createAuditLogFromReq(req, user.id, "UPDATE_PROFILE", `User updated their profile`);
      res.json({ user: { id: updatedUser.id, name: updatedUser.name, nis: updatedUser.nis, role: updatedUser.role } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Journals: Get user entries
  app.get("/api/journals", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const entries = await prisma.entry.findMany({
        where: { userId: decoded.id },
        orderBy: { createdAt: "desc" },
        include: {
          reactions: true,
          _count: {
            select: { comments: true }
          }
        }
      });
      res.json(entries);
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Journals: Create entry
  app.post("/api/journals", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { title, body, mood, moodLabel, ref1, ref2, ref3 } = req.body;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const entry = await prisma.entry.create({
        data: {
          title,
          body,
          mood,
          moodLabel,
          ref1,
          ref2,
          ref3,
          userId: decoded.id,
        },
      });
      await createAuditLogFromReq(req, decoded.id, "CREATE_ENTRY", `Created journal: ${title}`);
      res.json(entry);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.put("/api/journals/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { title, body, mood, moodLabel, ref1, ref2, ref3 } = req.body;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      
      const existingEntry = await prisma.entry.findUnique({ where: { id } });
      if (!existingEntry || existingEntry.userId !== decoded.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updatedEntry = await prisma.entry.update({
        where: { id },
        data: { title, body, mood, moodLabel, ref1, ref2, ref3 },
      });

      await createAuditLogFromReq(req, decoded.id, "UPDATE_ENTRY", `Updated journal: ${id}`);
      res.json(updatedEntry);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  app.delete("/api/journals/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      
      const existingEntry = await prisma.entry.findUnique({ where: { id } });
      if (!existingEntry) return res.status(404).json({ error: "Not found" });

      // Allow owner OR Admin
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (existingEntry.userId !== decoded.id && user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await prisma.entry.delete({ where: { id } });
      await createAuditLogFromReq(req, decoded.id, "DELETE_ENTRY", `Deleted journal: ${id} by ${user?.role}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // Comments: Add comment
  app.post("/api/journals/:id/comments", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id: entryId } = req.params;
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: "Komentar tidak boleh kosong" });
    }

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);

      // Hanya pemilik jurnal atau admin yang boleh komentar
      const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { userId: true } });
      if (!entry) return res.status(404).json({ error: "Jurnal tidak ditemukan" });
      const commenter = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (entry.userId !== decoded.id && commenter?.role !== "ADMIN") {
        return res.status(403).json({ error: "Hanya pemilik jurnal atau admin yang dapat berkomentar." });
      }
      
      const comment = await prisma.comment.create({
        data: {
          body,
          userId: decoded.id,
          entryId,
        },
        include: {
          user: {
            select: { name: true, role: true }
          }
        }
      });

      await createAuditLogFromReq(req, decoded.id, "ADD_COMMENT", `Added comment to journal: ${entryId}`);
      res.json(comment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Comments: Get comments for entry (hanya pemilik atau admin)
  app.get("/api/journals/:id/comments", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const { id: entryId } = req.params;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { userId: true } });
      if (!entry) return res.status(404).json({ error: "Jurnal tidak ditemukan" });
      const requester = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (entry.userId !== decoded.id && requester?.role !== "ADMIN") {
        return res.status(403).json({ error: "Akses ditolak." });
      }

      const comments = await prisma.comment.findMany({
        where: { entryId },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { name: true, role: true, id: true }
          }
        }
      });
      res.json(comments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Comments: Delete comment
  app.delete("/api/comments/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      
      const comment = await prisma.comment.findUnique({ where: { id } });
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (comment.userId !== decoded.id && user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden" });
      }

      await prisma.comment.delete({ where: { id } });
      await createAuditLogFromReq(req, decoded.id, "DELETE_COMMENT", `Deleted comment: ${id}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Feed: Get all public entries
  // Feed: Admin-only — siswa tidak dapat mengakses jurnal milik siswa lain
  app.get("/api/feed", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const requester = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (requester?.role !== "ADMIN") {
        return res.status(403).json({ error: "Hanya admin yang dapat mengakses feed." });
      }

      const entries = await prisma.entry.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, nis: true }
          },
          reactions: true,
          _count: {
            select: { comments: true }
          }
        }
      });
      res.json(entries);
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Journals: Increment view count (hanya pemilik atau admin)
  app.post("/api/journals/:id/view", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const entry = await prisma.entry.findUnique({ where: { id }, select: { userId: true } });
      if (!entry) return res.status(404).json({ error: "Not found" });
      const viewer = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (entry.userId !== decoded.id && viewer?.role !== "ADMIN") {
        return res.status(403).json({ error: "Akses ditolak." });
      }
      const updated = await prisma.entry.update({
        where: { id },
        data: { viewCount: { increment: 1 } }
      });
      res.json({ viewCount: updated.viewCount });
    } catch (err) {
      res.status(500).json({ error: "Failed to increment view count" });
    }
  });

  // Reactions: Post reaction (hanya pemilik jurnal atau admin)
  app.post("/api/journals/:id/reactions", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id: entryId } = req.params;
    const { type } = req.body; 

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);

      // Hanya pemilik jurnal atau admin yang boleh react
      const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { userId: true } });
      if (!entry) return res.status(404).json({ error: "Jurnal tidak ditemukan" });
      const reactor = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (entry.userId !== decoded.id && reactor?.role !== "ADMIN") {
        return res.status(403).json({ error: "Hanya pemilik jurnal atau admin yang dapat memberikan reaksi." });
      }
      
      const existing = await prisma.reaction.findUnique({
        where: {
          userId_entryId: {
            userId: decoded.id,
            entryId,
          }
        }
      });

      if (existing) {
        return res.status(400).json({ error: "Anda sudah memberikan reaksi dan tidak dapat menggantinya." });
      }

      await prisma.reaction.create({
        data: {
          type,
          userId: decoded.id,
          entryId,
        }
      });
      res.json({ action: "ADDED" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  // Admin: Real-time Audit Logs & Stats
  app.get("/api/admin/stats", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const admin = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (admin?.role !== Role.ADMIN) return res.status(403).json({ error: "Forbidden" });

      const [totalUsers, totalEntries, recentLogs, allEntries, allUsers] = await Promise.all([
       prisma.user.count(),
       prisma.entry.count(),
       prisma.auditLog.findMany({
         take: 50,
         orderBy: { createdAt: "desc" },
         include: { user: { select: { name: true } } }
       }),
       prisma.entry.findMany({
         take: 2000,
         orderBy: { createdAt: "desc" },
         include: {
           user: {
             select: {
               name: true,
               nis: true
             }
           },
           reactions: true,
           _count: {
             select: { comments: true }
           }
         }
       }),
       prisma.user.findMany({
         where: { role: Role.STUDENT },
         orderBy: { createdAt: "desc" },
         select: { id: true, name: true, nis: true, status: true, createdAt: true }
       })
     ]);
     res.json({ totalUsers, totalEntries, recentLogs, allEntries, allUsers });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Fetch failed" });
    }
  });

  // Admin: User Management
  app.delete("/api/admin/users/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    
    const { id } = req.params;
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const admin = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (admin?.role !== Role.ADMIN) return res.status(403).json({ error: "Forbidden" });

      await prisma.$transaction([
        prisma.reaction.deleteMany({ where: { userId: id } }),
        prisma.comment.deleteMany({ where: { userId: id } }),
        prisma.jawabanKuesioner.deleteMany({ where: { userId: id } }),
        prisma.auditLog.deleteMany({ where: { userId: id } }),
        prisma.entry.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } })
      ]);
      
      await createAuditLog(decoded.id, "ADMIN_DELETE_USER", `Deleted student account: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/users/:id/status", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    
    const { id } = req.params;
    const { status } = req.body;
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const admin = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (admin?.role !== Role.ADMIN) return res.status(403).json({ error: "Forbidden" });

      const user = await prisma.user.update({
        where: { id },
        data: { status }
      });

      await createAuditLog(decoded.id, "ADMIN_TOGGLE_STATUS", `Set user ${id} status to ${status}`);
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== KUESIONER API =====

  // Helper: pastikan admin
  const requireAdmin = async (authHeader: string | undefined, res: any): Promise<any | null> => {
    if (!authHeader) { res.status(401).json({ error: "Unauthorized" }); return null; }
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, role: true } });
      if (user?.role !== Role.ADMIN) { res.status(403).json({ error: "Forbidden" }); return null; }
      return decoded;
    } catch { res.status(401).json({ error: "Invalid token" }); return null; }
  };

  // Helper: pastikan authenticated (siapapun)
  const requireAuth = (authHeader: string | undefined, res: any): any | null => {
    if (!authHeader) { res.status(401).json({ error: "Unauthorized" }); return null; }
    try {
      return jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch { res.status(401).json({ error: "Invalid token" }); return null; }
  };

  // GET /api/kuesioner — admin: semua, siswa: hanya yang AKTIF + belum dijawab & sudah dijawab
  app.get("/api/kuesioner", async (req, res) => {
    const decoded = requireAuth(req.headers.authorization, res);
    if (!decoded) return;
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { role: true } });
      if (user?.role === "ADMIN") {
        const list = await prisma.kuesioner.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            indikator: {
              orderBy: { urutan: "asc" },
              include: {
                pertanyaan: {
                  orderBy: { urutan: "asc" },
                  include: { opsi: { orderBy: { urutan: "asc" } } }
                }
              }
            },
            _count: { select: { jawaban: true } },
          }
        });
        return res.json(list);
      }
      // Siswa: semua kuesioner AKTIF
      const list = await prisma.kuesioner.findMany({
        where: { status: "AKTIF" },
        orderBy: { createdAt: "desc" },
        include: {
          indikator: {
            orderBy: { urutan: "asc" },
            include: {
              pertanyaan: {
                orderBy: { urutan: "asc" },
                include: { opsi: { orderBy: { urutan: "asc" } } }
              }
            }
          },
          jawaban: { where: { userId: decoded.id }, select: { id: true, submittedAt: true } }
        }
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/kuesioner — admin: buat kuesioner baru
  app.post("/api/kuesioner", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { judul, deskripsi, jenis } = req.body;
    if (!judul?.trim()) return res.status(400).json({ error: "Judul wajib diisi" });
    try {
      const k = await prisma.kuesioner.create({
        data: { judul, deskripsi: deskripsi || null, jenis: jenis || "UMUM", createdById: decoded.id },
        include: {
          indikator: { include: { pertanyaan: { include: { opsi: true } } } },
          _count: { select: { jawaban: true } },
        }
      });
      await createAuditLog(decoded.id, "CREATE_KUESIONER", `Created kuesioner: ${judul}`);
      res.json(k);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/kuesioner/:id — update judul/deskripsi/jenis/status
  app.patch("/api/kuesioner/:id", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id } = req.params;
    const { judul, deskripsi, jenis, status } = req.body;
    try {
      const k = await prisma.kuesioner.update({
        where: { id },
        data: { 
          ...(judul !== undefined && { judul }),
          ...(deskripsi !== undefined && { deskripsi }),
          ...(jenis !== undefined && { jenis }),
          ...(status !== undefined && { status }),
        }
      });
      await createAuditLog(decoded.id, "UPDATE_KUESIONER", `Updated kuesioner: ${id} status=${status || '-'}`);
      res.json(k);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/kuesioner/:id — hapus kuesioner + cascade
  app.delete("/api/kuesioner/:id", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id } = req.params;
    try {
      await prisma.kuesioner.delete({ where: { id } });
      await createAuditLog(decoded.id, "DELETE_KUESIONER", `Deleted kuesioner: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/kuesioner/:id/indikator — tambah indikator
  app.post("/api/kuesioner/:id/indikator", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id: kuesionerId } = req.params;
    const { nama, deskripsi, urutan } = req.body;
    if (!nama?.trim()) return res.status(400).json({ error: "Nama indikator wajib diisi" });
    try {
      const ind = await prisma.indikator.create({
        data: { nama, deskripsi: deskripsi || null, urutan: urutan || 0, kuesionerId }
      });
      res.json(ind);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/indikator/:id
  app.delete("/api/indikator/:id", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id } = req.params;
    try {
      await prisma.indikator.delete({ where: { id } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/indikator/:id/pertanyaan — tambah pertanyaan ke indikator
  app.post("/api/indikator/:id/pertanyaan", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id: indikatorId } = req.params;
    const { teks, jenis, urutan, wajib, opsi } = req.body;
    if (!teks?.trim()) return res.status(400).json({ error: "Teks pertanyaan wajib diisi" });
    try {
      const p = await prisma.pertanyaan.create({
        data: {
          teks,
          jenis: jenis || "LIKERT",
          urutan: urutan || 0,
          wajib: wajib !== false,
          indikatorId,
          ...(opsi && opsi.length > 0 && {
            opsi: {
              create: opsi.map((o: any, i: number) => ({
                teks: o.teks,
                nilai: o.nilai || i,
                urutan: i
              }))
            }
          })
        },
        include: { opsi: { orderBy: { urutan: "asc" } } }
      });
      res.json(p);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/pertanyaan/:id
  app.delete("/api/pertanyaan/:id", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id } = req.params;
    try {
      await prisma.pertanyaan.delete({ where: { id } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/kuesioner/:id/jawab — siswa submit jawaban
  app.post("/api/kuesioner/:id/jawab", async (req, res) => {
    const decoded = requireAuth(req.headers.authorization, res);
    if (!decoded) return;
    const { id: kuesionerId } = req.params;
    const { jawaban } = req.body; // [{pertanyaanId, nilaiTeks?, nilaiAngka?, nilaiOpsiId?}]
    if (!jawaban || !Array.isArray(jawaban)) return res.status(400).json({ error: "Jawaban tidak valid" });
    try {
      // Cek kuesioner aktif
      const k = await prisma.kuesioner.findUnique({ where: { id: kuesionerId }, select: { status: true } });
      if (!k) return res.status(404).json({ error: "Kuesioner tidak ditemukan" });
      if (k.status !== "AKTIF") return res.status(400).json({ error: "Kuesioner tidak aktif" });
      // Cek sudah pernah jawab
      const existing = await prisma.jawabanKuesioner.findUnique({
        where: { kuesionerId_userId: { kuesionerId, userId: decoded.id } }
      });
      if (existing) return res.status(400).json({ error: "Anda sudah mengisi kuesioner ini" });

      const result = await prisma.jawabanKuesioner.create({
        data: {
          kuesionerId,
          userId: decoded.id,
          detail: {
            create: jawaban.map((j: any) => ({
              pertanyaanId: j.pertanyaanId,
              nilaiTeks: j.nilaiTeks || null,
              nilaiAngka: j.nilaiAngka !== undefined ? j.nilaiAngka : null,
              nilaiOpsiId: j.nilaiOpsiId || null,
            }))
          }
        }
      });
      await createAuditLogFromReq(req, decoded.id, "SUBMIT_KUESIONER", `Submitted kuesioner: ${kuesionerId}`);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kuesioner/:id/hasil — admin lihat hasil per-siswa
  app.get("/api/kuesioner/:id/hasil", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    const { id: kuesionerId } = req.params;
    try {
      const hasil = await prisma.jawabanKuesioner.findMany({
        where: { kuesionerId },
        include: {
          user: { select: { id: true, name: true, nis: true } },
          detail: {
            include: {
              // include the pertanyaan and its opsi so frontend can resolve selected pilihan teks
              pertanyaan: { include: { opsi: true } }
            }
          }
        },
        orderBy: { submittedAt: "desc" }
      });
      res.json(hasil);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kuesioner/riwayat-saya — riwayat jawaban kuesioner milik user yang login
  app.get("/api/kuesioner/riwayat-saya", async (req, res) => {
    const decoded = requireAuth(req.headers.authorization, res);
    if (!decoded) return;
    try {
      const riwayat = await prisma.jawabanKuesioner.findMany({
        where: { userId: decoded.id },
        orderBy: { submittedAt: "desc" },
        include: {
          kuesioner: {
            select: {
              id: true, judul: true, deskripsi: true, jenis: true,
              indikator: {
                orderBy: { urutan: "asc" },
                include: {
                  pertanyaan: {
                    orderBy: { urutan: "asc" },
                    include: { opsi: { orderBy: { urutan: "asc" } } }
                  }
                }
              }
            }
          },
          detail: {
            include: {
              pertanyaan: { select: { id: true, teks: true, jenis: true, indikatorId: true } }
            }
          }
        }
      });
      res.json(riwayat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kuesioner/semua-jawaban — admin: semua jawaban kuesioner semua siswa
  app.get("/api/kuesioner/semua-jawaban", async (req, res) => {
    const decoded = await requireAdmin(req.headers.authorization, res);
    if (!decoded) return;
    try {
      // Ambil semua kuesioner beserta semua jawaban siswa
      const kuesionerList = await prisma.kuesioner.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          indikator: {
            orderBy: { urutan: "asc" },
            include: {
              pertanyaan: {
                orderBy: { urutan: "asc" },
                include: { opsi: { orderBy: { urutan: "asc" } } }
              }
            }
          },
          jawaban: {
            orderBy: { submittedAt: "desc" },
            include: {
              user: { select: { id: true, name: true, nis: true } },
              detail: {
                include: {
                  pertanyaan: { select: { id: true, teks: true, jenis: true, indikatorId: true } }
                }
              }
            }
          },
          _count: { select: { jawaban: true } }
        }
      });
      res.json(kuesionerList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Audit logging active.");
  });
}

startServer().catch(console.error);
