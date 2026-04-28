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

  // Middleware Audit Log
  const createAuditLog = async (userId: string | null, action: string, details?: string) => {
    try {
      await prisma.auditLog.create({
        data: { userId, action, details },
      });
    } catch (err) {
      console.error("Audit log failed:", err);
    }
  };

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
      await createAuditLog(user.id, "LOGIN", `User ${user.name} logged in`);

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

      await createAuditLog(user.id, "REGISTER", `New student registered: ${name}`);
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

      await createAuditLog(user.id, "UPDATE_PROFILE", `User updated their profile`);
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
      await createAuditLog(decoded.id, "CREATE_ENTRY", `Created journal: ${title}`);
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

      await createAuditLog(decoded.id, "UPDATE_ENTRY", `Updated journal: ${id}`);
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
      await createAuditLog(decoded.id, "DELETE_ENTRY", `Deleted journal: ${id} by ${user?.role}`);
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

      await createAuditLog(decoded.id, "ADD_COMMENT", `Added comment to journal: ${entryId}`);
      res.json(comment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Comments: Get comments for entry
  app.get("/api/journals/:id/comments", async (req, res) => {
    const { id: entryId } = req.params;

    try {
      const comments = await prisma.comment.findMany({
        where: { entryId },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { name: true, role: true }
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
      await createAuditLog(decoded.id, "DELETE_COMMENT", `Deleted comment: ${id}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Feed: Get all public entries
  app.get("/api/feed", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    try {
      jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      
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

  // Journals: Increment view count
  app.post("/api/journals/:id/view", async (req, res) => {
    const { id } = req.params;
    try {
      const entry = await prisma.entry.update({
        where: { id },
        data: { viewCount: { increment: 1 } }
      });
      res.json({ viewCount: entry.viewCount });
    } catch (err) {
      res.status(500).json({ error: "Failed to increment view count" });
    }
  });

  // Reactions: Post reaction (cannot toggle/remove/change)
  app.post("/api/journals/:id/reactions", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { id: entryId } = req.params;
    const { type } = req.body; 

    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      
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
        prisma.entry.deleteMany({ where: { userId: id } }),
        prisma.auditLog.deleteMany({ where: { userId: id } }),
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
