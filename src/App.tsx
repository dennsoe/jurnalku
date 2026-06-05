import React, { useState, useEffect, createContext, useContext } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  History, 
  BarChart3, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  Activity,
  PlusCircle,
  ChevronRight,
  Smile,
  Zap,
  Calendar,
  Grid,
  Search,
  Pencil,
  Check,
  X,
  Save,
  Download,
  FileSpreadsheet,
  Trash2,
  UserX,
  UserCheck,
  Eye,
  AlertCircle,
  MessageCircle,
  Send,
  Sun,
  Moon,
  Monitor,
  ClipboardList,
  Lock,
  Plus,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  AlignLeft,
  Star,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  SlidersHorizontal,
  FileQuestion,
  Users,
  BarChart2,
  ArrowLeft,
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { cn, MOODS, apiFetch } from "./lib/utils";

// ===== THEME SYSTEM =====
type Theme = 'light' | 'dark' | 'system';
interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
});
function useTheme() { return useContext(ThemeContext); }

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const s = localStorage.getItem('theme') as Theme | null;
    return s === 'light' || s === 'dark' || s === 'system' ? s : 'system';
  });
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  };
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
  const config: Record<Theme, { icon: React.ReactNode; label: string }> = {
    light:  { icon: <Sun size={14} />,     label: 'Light' },
    dark:   { icon: <Moon size={14} />,    label: 'Dark'  },
    system: { icon: <Monitor size={14} />, label: 'System' },
  };
  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
      title={`Tema: ${config[theme].label} — klik ganti`}
      aria-label={`Tema aktif: ${config[theme].label}`}
    >
      {config[theme].icon}
    </button>
  );
}
// ===== END THEME SYSTEM =====

// --- Types ---
interface User {
  id: string;
  name: string;
  nis: string;
  role: "STUDENT" | "ADMIN";
}

interface Comment {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  user: {
    name: string;
    role: "STUDENT" | "ADMIN";
  };
}

interface Reaction {
  id: string;
  type: string;
  userId: string;
  entryId: string;
}

interface Entry {
  id: string;
  title: string;
  body: string;
  mood: string;
  moodLabel: string;
  ref1?: string;
  ref2?: string;
  ref3?: string;
  createdAt: string;
  viewCount: number;
  userId: string;
  reactions: Reaction[];
  user?: {
    id: string;
    name: string;
    nis: string;
  };
  comments?: Comment[];
  _count?: {
    comments: number;
  };
}

// ===== KUESIONER TYPES =====
type JenisKuesioner = "UMUM" | "SOSIOMETRI" | "DCM" | "INVENTORI";
type StatusKuesioner = "DRAFT" | "AKTIF" | "TUTUP";
type JenisPertanyaan = "LIKERT" | "SKALA" | "PILIHAN_GANDA" | "YA_TIDAK" | "ESAI";

interface OpsiJawaban { id: string; teks: string; nilai: number; urutan: number; }
interface Pertanyaan {
  id: string; teks: string; jenis: JenisPertanyaan;
  urutan: number; wajib: boolean; indikatorId: string;
  opsi: OpsiJawaban[];
}
interface Indikator {
  id: string; nama: string; deskripsi?: string;
  urutan: number; kuesionerId: string;
  pertanyaan: Pertanyaan[];
}
interface Kuesioner {
  id: string; judul: string; deskripsi?: string;
  jenis: JenisKuesioner; status: StatusKuesioner;
  createdAt: string; updatedAt: string;
  indikator: Indikator[];
  jawaban?: { id: string; submittedAt: string }[];
  _count?: { jawaban: number };
}

// --- App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      if (u.role === "ADMIN") setActiveTab("admin");
    }
    setLoading(false);
  }, []);

  if (loading) return <div className="h-screen bg-linear-to-br from-emerald-50 dark:from-gray-950 to-white dark:to-gray-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-t-emerald-500 border-emerald-100 dark:border-emerald-900 rounded-full animate-spin" />
      <span className="text-xs uppercase tracking-widest font-mono text-emerald-600">Memuat Sistem...</span>
    </div>
  </div>;

  if (!user) return <LoginPage onLogin={(u) => {
    setUser(u);
    if (u.role === "ADMIN") setActiveTab("admin");
  }} />;

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900 selection:text-emerald-800 dark:selection:text-emerald-200 relative overflow-x-hidden">
      {/* ===== Animated Background Blobs ===== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="blob-1 absolute top-[-15%] right-[-5%] w-125 h-125 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-3xl opacity-50 dark:opacity-20" />
        <div className="blob-2 absolute bottom-[-10%] left-[-8%] w-96 h-96 bg-teal-100 dark:bg-teal-900/20 rounded-full blur-3xl opacity-40 dark:opacity-20" />
        <div className="blob-3 absolute top-[35%] left-[55%] w-72 h-72 bg-emerald-50 dark:bg-emerald-900/15 rounded-full blur-2xl opacity-60 dark:opacity-10" />
        <div className="blob-4 absolute top-[60%] right-[20%] w-64 h-64 bg-green-50 dark:bg-green-900/15 rounded-full blur-2xl opacity-50 dark:opacity-10" />
      </div>

      {/* Content above blobs */}
      <div className="relative z-10">
      {/* Top Nav */}
      <nav className="h-12 sm:h-14 border-b border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-serif text-base sm:text-lg font-bold text-[#10b981]">Jurnal Self Acceptance</span>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button 
            onClick={() => setActiveTab("profile")}
            className="flex items-center gap-2 group transition-all"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium leading-none mb-0.5 text-gray-700 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{user.name}</div>
              <div className="text-[9px] text-gray-400 dark:text-gray-600 tracking-tighter uppercase font-mono">{user.role} • {user.nis}</div>
            </div>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#10b981] flex items-center justify-center text-white font-bold text-[9px] sm:text-xs ring-2 ring-emerald-200 dark:ring-emerald-800 group-hover:ring-emerald-400 transition-all">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </button>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all"
            title="Keluar"
          >
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 sm:p-5 mb-20 min-h-[calc(100vh-140px)]">
        <AnimatePresence mode="wait">
          {activeTab === "home" && <StudentDashboard user={user} key="home" />}
          {activeTab === "intervensi" && <IntervensiPage user={user} key="intervensi" />}
          {activeTab === "write" && <WritePage user={user} key="write" onSave={() => setActiveTab("home")} />}
          {activeTab === "history" && <HistoryPage user={user} key="history" />}
          {activeTab === "grafik" && <GrafikPage user={user} key="grafik" />}
          {activeTab === "profile" && <ProfilePage user={user} onUpdate={setUser} key="profile" />}
          {activeTab === "admin" && <AdminMonitor user={user} key="admin" />}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 z-50 pointer-events-none">
        <div className="max-w-md mx-auto bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-1.5 flex justify-around items-center shadow-2xl shadow-gray-200/80 dark:shadow-gray-950 pointer-events-auto">
          <NavButton active={activeTab === "home"} onClick={() => setActiveTab("home")} icon={<BookOpen size={18} />} label="Home" />
          <NavButton active={activeTab === "intervensi"} onClick={() => setActiveTab("intervensi")} icon={<ClipboardList size={18} />} label="Intervensi" />
          <NavButton active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={<History size={18} />} label="Riwayat" />
          <NavButton active={activeTab === "grafik"} onClick={() => setActiveTab("grafik")} icon={<BarChart3 size={18} />} label="Grafik" />
          {user.role === "ADMIN" && (
            <NavButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")} icon={<ShieldCheck size={18} />} label="Admin" />
          )}
        </div>
      </div>

      {/* Floating Action Button for Writing */}
      {activeTab !== "write" && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab("write")}
          className="fixed bottom-24 right-6 w-11 h-11 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-300/60 dark:shadow-none z-40 sm:bottom-28 sm:right-8"
        >
          <PlusCircle size={22} />
        </motion.button>
      )}

      <ConfirmModal 
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          localStorage.clear();
          setUser(null);
          setShowLogoutConfirm(false);
        }}
        title="Konfirmasi Logout"
        message="Apakah Anda yakin ingin keluar dari sistem Jurnal Self Acceptance? Semua sesi Anda akan dihentikan."
        confirmLabel="Ya, Keluar"
        confirmVariant="danger"
      />
      </div>{/* end relative z-10 */}
    </div>
    </ThemeProvider>
  );
}

// --- Subpages ---

function NavButton({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 py-1 px-2 sm:px-3 rounded-lg transition-all duration-300 flex-1 sm:flex-none",
        active ? "text-[#10b981] bg-emerald-100 dark:bg-emerald-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      )}
    >
      <div className="scale-75 sm:scale-90">{icon}</div>
      <span className="text-[8px] sm:text-[9px] font-medium uppercase tracking-widest leading-none">{label}</span>
    </button>
  );
}

function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [nis, setNis] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState<{nis?: string, password?: string, name?: string}>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errors: {nis?: string, password?: string, name?: string} = {};
    if (!nis) errors.nis = "NIS wajib diisi";
    else if (nis !== "admin" && !/^\d{7,10}$/.test(nis)) errors.nis = "NIS harus berupa 7-10 digit angka";
    
    if (isRegister && !name) errors.name = "Nama lengkap wajib diisi";
    
    if (!password) errors.password = "Passphrase wajib diisi";
    else if (password.length < 4) errors.password = "Passphrase terlalu pendek";
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister ? { nis, name, password } : { nis, password };
      
      const data = await apiFetch(endpoint, { 
        method: "POST", 
        body: JSON.stringify(payload) 
      });

      if (isRegister) {
        setIsRegister(false);
        setError("");
        setSuccess("Registrasi berhasil! Silakan masuk.");
        setName("");
        setPassword("");
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="blob-1 absolute top-[-15%] right-[-5%] w-125 h-125 bg-emerald-100 rounded-full blur-3xl opacity-40" />
      <div className="blob-2 absolute bottom-[-15%] left-[-10%] w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-50" />
      <div className="blob-3 absolute top-[30%] left-[40%] w-64 h-64 bg-green-100 rounded-full blur-2xl opacity-30" />
      
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-75 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 relative z-10 shadow-xl shadow-emerald-100/60 dark:shadow-gray-950"
      >
        <div className="mb-5 text-center">
          <h1 className="font-serif text-xl font-bold text-[#10b981] mb-0.5">Jurnal Self Acceptance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-[9px] tracking-[0.2em] uppercase">
            {isRegister ? "Registrasi Akun" : "Self Acceptance Portal SMK"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Nomor Induk Siswa</label>
            <input 
              value={nis} 
              onChange={e => {
                setNis(e.target.value);
                if (validationErrors.nis) setValidationErrors({...validationErrors, nis: undefined});
              }}
              className={cn(
                "w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all",
                validationErrors.nis ? "border-red-500/50 focus:border-red-500" : "border-gray-200 focus:border-emerald-400"
              )}
              placeholder="Contoh: 2024001"
            />
            {validationErrors.nis && <p className="text-[9px] text-red-500 ml-1">{validationErrors.nis}</p>}
          </div>

          {isRegister && (
            <div className="space-y-1.5">
              <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)}
                className={cn(
                  "w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all",
                  validationErrors.name ? "border-red-500/50 focus:border-red-500" : "border-gray-200 focus:border-emerald-400"
                )}
                placeholder="Nama sesuai raport"
              />
              {validationErrors.name && <p className="text-[9px] text-red-500 ml-1">{validationErrors.name}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Passphrase</label>
            <input 
              type="password"
              value={password} 
              onChange={e => {
                setPassword(e.target.value);
                if (validationErrors.password) setValidationErrors({...validationErrors, password: undefined});
              }}
              className={cn(
                "w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all",
                validationErrors.password ? "border-red-500/50 focus:border-red-500" : "border-gray-200 focus:border-emerald-400"
              )}
              placeholder="••••••••"
            />
            {validationErrors.password && <p className="text-[9px] text-red-500 ml-1">{validationErrors.password}</p>}
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              <p className="text-red-400 text-[10px] text-center uppercase tracking-widest font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
              <p className="text-green-400 text-[10px] text-center uppercase tracking-widest font-bold">{success}</p>
            </div>
          )}

          <button 
            disabled={submitting}
            className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 text-xs mt-1"
          >
            {submitting ? <Activity size={12} className="animate-spin mx-auto" /> : (isRegister ? "Daftar Akun" : "Masuk ke Sistem")}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] text-[#10b981] uppercase tracking-widest font-bold hover:underline"
          >
            {isRegister ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar Sekarang"}
          </button>
        </div>
        
        <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-8 leading-relaxed">
          Sistem Terenkripsi & Diaudit Secara Real-time.<br/>
          Gunakan kredensial yang diberikan oleh operator sekolah.
        </p>
      </motion.div>
    </div>
  );
}

const REACTION_TYPES = [
  { type: "LOVE", emoji: "❤️", label: "Cinta" },
  { type: "CLAP", emoji: "👏", label: "Hebat" },
  { type: "SUPPORT", emoji: "🙌", label: "Dukung" },
  { type: "CELEBRATE", emoji: "🎉", label: "Rayakan" },
  { type: "INSPIRED", emoji: "💡", label: "Inspiratif" },
  { type: "FIRE", emoji: "🔥", label: "Api" },
  { type: "CARE", emoji: "🤗", label: "Sayang" },
  { type: "STRONG", emoji: "💪", label: "Kuat" },
];

function ReactionButton({ type, emoji, count, active, disabled, onClick }: { type: string, emoji: string, count: number, active: boolean, disabled: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={active || disabled ? undefined : onClick}
      disabled={disabled && !active}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] transition-all relative group",
        active 
          ? "bg-emerald-50 border-emerald-400 text-emerald-600 scale-105 shadow-sm" 
          : disabled 
            ? "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 opacity-60 cursor-not-allowed"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-200 hover:text-emerald-600 active:scale-95 cursor-pointer shadow-sm"
      )}
    >
      <span className={cn("transition-transform", !disabled && !active && "group-hover:scale-120")}>{emoji}</span>
      {count > 0 && <span className="font-bold font-mono">{count}</span>}
      {active && (
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full ring-2 ring-white"
        />
      )}
    </button>
  );
}

function IntervensiPage({ user }: { user: User }) {
  const [list, setList] = useState<Kuesioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Kuesioner | null>(null);

  const fetchKuesioner = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/kuesioner");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("IntervensiPage fetch error:", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKuesioner(); }, []);

  if (selected) return (
    <IsiKuesionerPage
      kuesioner={selected}
      user={user}
      onBack={() => { setSelected(null); fetchKuesioner(); }}
    />
  );

  const JENIS_LABEL: Record<JenisKuesioner, string> = {
    UMUM: "Umum", SOSIOMETRI: "Sosiometri", DCM: "DCM", INVENTORI: "Inventori"
  };
  const JENIS_COLOR: Record<JenisKuesioner, string> = {
    UMUM: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900",
    SOSIOMETRI: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900",
    DCM: "bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900",
    INVENTORI: "bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-900",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#10b981]">Intervensi</h2>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold mt-1">Program & Kuesioner dari Guru BK</p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-200 dark:text-gray-700">
          <Activity size={24} className="animate-spin text-[#10b981]" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Memuat...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-gray-50 dark:bg-gray-900/50">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center">
            <ClipboardList size={28} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-bold text-sm text-gray-700 dark:text-gray-200 mb-1">Belum Ada Kuesioner Aktif</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Kuesioner dari Guru BK akan muncul di sini</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map(k => {
            const sudahDiisi = (k.jawaban || []).length > 0;
            const totalPertanyaan = k.indikator.reduce((s, i) => s + i.pertanyaan.length, 0);
            return (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white dark:bg-gray-900 border rounded-2xl p-4 sm:p-5 shadow-sm transition-all",
                  sudahDiisi ? "border-emerald-200 dark:border-emerald-800" : "border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md cursor-pointer"
                )}
                onClick={sudahDiisi ? undefined : () => setSelected(k)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", JENIS_COLOR[k.jenis])}>
                        {JENIS_LABEL[k.jenis]}
                      </span>
                      {sudahDiisi && (
                        <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <Check size={8} /> Sudah Diisi
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1 leading-tight">{k.judul}</h3>
                    {k.deskripsi && <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{k.deskripsi}</p>}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <ListChecks size={10} /> {k.indikator.length} Indikator
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <FileQuestion size={10} /> {totalPertanyaan} Pertanyaan
                      </span>
                      {sudahDiisi && k.jawaban?.[0] && (
                        <span className="text-[9px] text-emerald-500 flex items-center gap-1">
                          <Calendar size={10} /> {new Date(k.jawaban[0].submittedAt).toLocaleDateString("id-ID")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {sudahDiisi ? (
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                        <Check size={16} className="text-emerald-500" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                        <ChevronRight size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ===== ISI KUESIONER PAGE (Siswa) =====
function IsiKuesionerPage({ kuesioner, user, onBack }: { kuesioner: Kuesioner; user: User; onBack: () => void }) {
  const totalPertanyaan = kuesioner.indikator.reduce((s, i) => s + i.pertanyaan.length, 0);
  const [jawaban, setJawaban] = useState<Record<string, { nilaiTeks?: string; nilaiAngka?: number; nilaiOpsiId?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setJ = (pertanyaanId: string, val: typeof jawaban[string]) =>
    setJawaban(prev => ({ ...prev, [pertanyaanId]: val }));

  const handleSubmit = async () => {
    // Validasi wajib
    const missing = kuesioner.indikator.flatMap(i => i.pertanyaan).filter(p => p.wajib && !jawaban[p.id]);
    if (missing.length > 0) { setError(`${missing.length} pertanyaan wajib belum dijawab.`); return; }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/kuesioner/${kuesioner.id}/jawab`, {
        method: "POST",
        body: JSON.stringify({ jawaban: Object.entries(jawaban).map(([pertanyaanId, v]) => ({ pertanyaanId, ...v })) })
      });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const LIKERT_LABELS = ["Sangat Tidak Setuju", "Tidak Setuju", "Ragu-ragu", "Setuju", "Sangat Setuju"];

  if (submitted) return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
        <Check size={36} className="text-emerald-500" />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-1">Kuesioner Terkirim!</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Terima kasih telah mengisi kuesioner ini.</p>
      </div>
      <button onClick={onBack} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all">
        Kembali
      </button>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-emerald-600 transition-all shrink-0 mt-0.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 leading-tight">{kuesioner.judul}</h2>
          {kuesioner.deskripsi && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{kuesioner.deskripsi}</p>}
          <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-1"><ListChecks size={10} /> {kuesioner.indikator.length} Indikator</span>
            <span className="flex items-center gap-1"><FileQuestion size={10} /> {totalPertanyaan} Pertanyaan</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Progress Pengisian</span>
          <span className="text-[9px] font-bold text-emerald-600">{Object.keys(jawaban).length}/{totalPertanyaan}</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            animate={{ width: totalPertanyaan > 0 ? `${(Object.keys(jawaban).length / totalPertanyaan) * 100}%` : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Indikator & Pertanyaan */}
      {kuesioner.indikator.map((ind, iIdx) => (
        <section key={ind.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950 border-b border-emerald-100 dark:border-emerald-900">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-bold">{iIdx + 1}</div>
              <h4 className="font-bold text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{ind.nama}</h4>
            </div>
            {ind.deskripsi && <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1 ml-7">{ind.deskripsi}</p>}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {ind.pertanyaan.map((p, pIdx) => {
              const val = jawaban[p.id];
              return (
                <div key={p.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-[9px] font-bold text-gray-300 dark:text-gray-600 mt-0.5 shrink-0 font-mono">{pIdx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-100 leading-relaxed font-medium">
                        {p.teks}
                        {p.wajib && <span className="text-red-400 ml-1">*</span>}
                      </p>
                      {/* JENIS PERTANYAAN */}
                      <div className="mt-3">
                        {p.jenis === "LIKERT" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-5 gap-1.5">
                              {[1,2,3,4,5].map(n => (
                                <button key={n} onClick={() => setJ(p.id, { nilaiAngka: n })}
                                  className={cn("py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5",
                                    val?.nilaiAngka === n
                                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                      : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                                  {n}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between text-[8px] text-gray-300 dark:text-gray-600 uppercase tracking-wider px-1">
                              <span>{LIKERT_LABELS[0]}</span><span>{LIKERT_LABELS[4]}</span>
                            </div>
                          </div>
                        )}
                        {p.jenis === "SKALA" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
                              {Array.from({length:10},(_,i)=>i+1).map(n => (
                                <button key={n} onClick={() => setJ(p.id, { nilaiAngka: n })}
                                  className={cn("py-2 rounded-lg text-xs font-bold transition-all border",
                                    val?.nilaiAngka === n
                                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                      : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                                  {n}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between text-[8px] text-gray-300 dark:text-gray-600 uppercase tracking-wider px-1">
                              <span>Rendah</span><span>Tinggi</span>
                            </div>
                          </div>
                        )}
                        {p.jenis === "YA_TIDAK" && (
                          <div className="flex gap-2">
                            {[{label:"Ya",val:1},{label:"Tidak",val:0}].map(o => (
                              <button key={o.label} onClick={() => setJ(p.id, { nilaiAngka: o.val })}
                                className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border",
                                  val?.nilaiAngka === o.val
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {p.jenis === "PILIHAN_GANDA" && (
                          <div className="space-y-2">
                            {p.opsi.map(o => (
                              <button key={o.id} onClick={() => setJ(p.id, { nilaiOpsiId: o.id, nilaiAngka: o.nilai })}
                                className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all border flex items-center gap-2.5",
                                  val?.nilaiOpsiId === o.id
                                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-400 text-emerald-700 dark:text-emerald-300"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                                <div className={cn("w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                                  val?.nilaiOpsiId === o.id ? "border-emerald-500" : "border-gray-300 dark:border-gray-600")}>
                                  {val?.nilaiOpsiId === o.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                </div>
                                {o.teks}
                              </button>
                            ))}
                          </div>
                        )}
                        {p.jenis === "ESAI" && (
                          <textarea
                            value={val?.nilaiTeks || ""}
                            onChange={e => setJ(p.id, { nilaiTeks: e.target.value })}
                            rows={3}
                            placeholder="Tuliskan jawaban Anda di sini..."
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 transition-all resize-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <><Activity size={14} className="animate-spin" /> Mengirim...</> : <><Send size={14} /> Submit Kuesioner</>}
      </button>
    </motion.div>
  );
}

function StudentDashboard({ user }: { user: User }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const endpoint = user.role === "ADMIN" ? "/api/admin/stats" : "/api/journals";
      const data = await apiFetch(endpoint);
      setEntries(user.role === "ADMIN" ? (data.allEntries || []) : data);
    } catch (err: any) {
      console.error("Fetch data error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const getStreak = () => {
    if (entries.length === 0 || user.role === "ADMIN") return 0;
    const days = new Set(entries.map(e => new Date(e.createdAt).toDateString()));
    let streak = 0;
    let d = new Date();
    while (days.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const streak = getStreak();
  const topMood = entries.length > 0 
    ? entries.reduce((acc: any, curr) => {
        acc[curr.mood] = (acc[curr.mood] || 0) + 1;
        return acc;
      }, {})
    : null;
  const popularMood = topMood ? Object.entries(topMood).sort((a: any, b: any) => b[1] - a[1])[0][0] : "—";

  const getGreeting = () => {
    if (user.role === "ADMIN") return "Monitoring korelasi emosional & kesehatan mental siswa hari ini.";
    const lastEntry = entries.length > 0 ? [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
    const mood = lastEntry?.mood || "Senang";

    switch(mood) {
      case "😄":
      case "Senang":
        return "Senang melihatmu ceria! Terus sebarkan energi positifmu hari ini.";
      case "😌":
      case "Tenang":
        return "Mari jaga ketenangan ini bersama.";
      case "😐":
      case "Biasa":
        return "Hari yang stabil adalah waktu yang tepat untuk bersyukur.";
      case "😔":
      case "Sedih":
        return "Tidak apa-apa untuk merasa sedih. Ceritakan saja.";
      case "😤":
      case "Frustrasi":
        return "Tarik napas dalam-dalam. Kamu lebih kuat.";
      case "😴":
      case "Lelah":
        return "Kamu sudah hebat. Jangan lupa beristirahat.";
      default:
        return "Senang melihatmu ceria! Terus sebarkan energi positifmu.";
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg sm:text-xl font-bold mb-0.5">Halo, {user.name.split(' ')[0]}!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-[10px] text-balance">{getGreeting()}</p>
        </div>
        <div className="self-start sm:self-center bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-lg px-2 py-1 text-[8px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
          <Calendar size={9} />
          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
        </div>
      </header>

      {/* Streak Banner / Admin Summary */}
      {user.role === "ADMIN" ? (
        <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={14} className="text-[#10b981]" />
              <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] font-bold">Integritas Sistem</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-serif font-bold text-[#10b981]">{entries.length}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">Total Jurnal Siswa</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 max-w-sm leading-relaxed">
              Anda sedang melihat data kumulatif dari seluruh ekosistem siswa untuk periode berjalan.
            </p>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-48 sm:w-64 h-48 sm:h-64 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      ) : (
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-4 sm:p-6 border transition-all duration-500",
          streak >= 3 
            ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 shadow-[0_0_30px_rgba(16,185,129,0.08)]" 
            : "bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800 shadow-sm"
        )}>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Zap size={14} className={cn(streak >= 3 ? "text-[#10b981]" : "text-gray-300 dark:text-gray-600")} />
                <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] font-bold">Current Streak</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-serif font-bold text-[#10b981]">{streak}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">Hari Berturut-turut</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 max-w-sm leading-relaxed">
                {streak === 0 ? "Mulai perjalanan harianmu hari ini!" : 
                 streak < 3 ? "Langkah pertama selalu yang terpenting." :
                 streak < 7 ? "Kebiasaan baru sedang terbentuk!" : "Luar biasa! Konsistensimu nyata."}
              </p>
            </div>
            <div className="text-5xl sm:text-6xl opacity-20 grayscale hover:grayscale-0 transition-all duration-700 self-end sm:self-center">
              {streak >= 7 ? "🏆" : streak >= 3 ? "🌟" : "📓"}
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-48 sm:w-64 h-48 sm:h-64 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total" value={entries.length} unit="Jurnal" />
        <StatCard label="Bulan Ini" value={entries.filter(e => new Date(e.createdAt).getMonth() === new Date().getMonth()).length} unit="Entries" />
        <StatCard label="Mood Utama" value={popularMood} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Recent Entries */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-[0.2em] font-bold">Jurnal Terbaru</h3>
        </div>
        <div className="grid gap-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-50 dark:bg-gray-900 rounded-2xl animate-pulse" />)
          ) : entries.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3">
              <BookOpen size={32} className="opacity-20" />
              <p className="text-xs uppercase tracking-widest">Belum ada jurnal yang tercatat</p>
            </div>
          ) : (
            entries.slice(0, 3).map(e => (
              <EntryCard key={e.id} entry={e} onUpdate={fetchData} />
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
}

function EntryCard({ entry, onUpdate }: { entry: Entry, onUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <div 
        onClick={() => setOpen(true)}
        className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md dark:hover:shadow-none shadow-sm group transition-all duration-300 cursor-pointer active:scale-[0.98]"
      >
        <div className="text-xl w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center border border-gray-100 dark:border-gray-800 group-hover:border-emerald-300 transition-all">
          {entry.mood}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-xs sm:text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{entry.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            {entry.user && (
              <span className="text-[9px] font-bold text-[#10b981] uppercase tracking-tighter bg-emerald-50/60 dark:bg-emerald-900/20 px-1 rounded">{entry.user.name}</span>
            )}
            <div className="flex items-center gap-2 text-[8px] text-gray-300 dark:text-gray-600 font-mono">
              <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><Eye size={8} className="text-[#10b981]" /> {entry.viewCount || 0}</span>
              <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><MessageCircle size={8} className="text-[#4cc9a0]" /> {entry._count?.comments || 0}</span>
              <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><Smile size={8} className="text-pink-400" /> {entry.reactions?.length || 0}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">{entry.body}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] sm:text-[9px] text-gray-300 dark:text-gray-600 uppercase tracking-tighter font-mono">
            {new Date(entry.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
          </p>
          <ChevronRight size={12} className="ml-auto mt-1 text-gray-200 dark:text-gray-700 group-hover:text-emerald-600/50 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      <JournalDetailModal 
        entry={entry} 
        open={open} 
        onClose={() => setOpen(false)} 
        onUpdate={onUpdate}
        canEdit={!entry.user} // Only editable if it's the student's own view (students don't see the user object in their list)
      />
    </>
  );
}

function JournalDetailModal({ entry, open, onClose, onUpdate, canEdit = true }: { 
  entry: Entry, 
  open: boolean, 
  onClose: () => void, 
  onUpdate?: () => void,
  canEdit?: boolean 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMood, setEditedMood] = useState(MOODS.find(m => m.emoji === entry.mood) || MOODS[0]);
  const [editedTitle, setEditedTitle] = useState(entry.title);
  const [editedBody, setEditedBody] = useState(entry.body);
  const [editedRef1, setEditedRef1] = useState(entry.ref1 || "");
  const [editedRef2, setEditedRef2] = useState(entry.ref2 || "");
  const [editedRef3, setEditedRef3] = useState(entry.ref3 || "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{title?: string, body?: string}>({});

  // Tentukan apakah user ini adalah pemilik jurnal atau admin
  const currentSessionUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isOwner = currentSessionUser.id === entry.userId || currentSessionUser.role === "ADMIN";
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>(entry.reactions || []);
  const [viewCount, setViewCount] = useState(entry.viewCount || 0);
  const [confirmData, setConfirmData] = useState<{open: boolean, onConfirm: () => void, title: string, message: string, isAlert?: boolean}>({
    open: false,
    onConfirm: () => {},
    title: "",
    message: "",
    isAlert: false
  });

  const incrementView = async () => {
    try {
      const data = await apiFetch(`/api/journals/${entry.id}/view`, { method: "POST" });
      setViewCount(data.viewCount);
    } catch (err) {
      console.error("View increment error:", err);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const data = await apiFetch(`/api/journals/${entry.id}/comments`);
      setComments(data);
    } catch (err) {
      console.error("Fetch comments error:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (open && !isEditing) {
      fetchComments();
      incrementView();
    }
  }, [open, isEditing]);

  const addReaction = async (type: string) => {
    // Hanya pemilik jurnal atau admin
    if (!isOwner) return;
    if (reactions.some(r => r.userId === currentSessionUser.id)) return;

    try {
      await apiFetch(`/api/journals/${entry.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ type })
      });
      
      setReactions([...reactions, { id: "temp", type, userId: currentSessionUser.id, entryId: entry.id }]);
    } catch (err: any) {
      console.error("Reaction error:", err);
    }
  };

  const validate = () => {
    const newErrors: {title?: string, body?: string} = {};
    if (!editedTitle.trim()) newErrors.title = "Judul wajib diisi";
    else if (editedTitle.length < 3) newErrors.title = "Judul minimal 3 karakter";
    
    if (!editedBody.trim()) newErrors.body = "Cerita harimu wajib diisi";
    else if (editedBody.length < 10) newErrors.body = "Cerita harimu terlalu singkat (min 10 karakter)";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/journals/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          title: editedTitle, 
          body: editedBody, 
          mood: editedMood.emoji, 
          moodLabel: editedMood.label,
          ref1: editedRef1,
          ref2: editedRef2,
          ref3: editedRef3
        })
      });
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setConfirmData({
        open: true,
        title: "Gagal Memperbarui",
        message: err.message,
        isAlert: true,
        onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
      } as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto border-t sm:border border-gray-200 dark:border-gray-700 shadow-2xl shadow-gray-300/30 dark:shadow-gray-950"
          >
            <div className="w-12 h-1 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-3 sm:hidden" />
            
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#10b981]">
                  {isEditing ? "Edit Jurnal" : "Detail Jurnal"}
                </h2>
                {entry.user && !isEditing && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1 font-bold">
                    Oleh: {entry.user.name} · {entry.user.nis}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    {canEdit && (
                      <button 
                        onClick={() => setIsEditing(true)} 
                        className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {canEdit && (
                      <button 
                        onClick={() => {
                          setConfirmData({
                            open: true,
                            title: "Hapus Jurnal",
                            message: "Apakah Anda yakin ingin menghapus jurnal ini selamanya?",
                            onConfirm: async () => {
                              try {
                                await apiFetch(`/api/journals/${entry.id}`, { method: "DELETE" });
                                setConfirmData(prev => ({ ...prev, open: false }));
                                onClose();
                                if (onUpdate) onUpdate();
                              } catch (err: any) {
                                setConfirmData({
                                  open: true,
                                  title: "Gagal Menghapus",
                                  message: err.message,
                                  isAlert: true,
                                  onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
                                });
                              }
                            }
                          } as any);
                        }}
                        className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-500 dark:text-gray-400 hover:text-red-400 dark:hover:text-red-400"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                )}
                <button 
                  onClick={onClose} 
                  className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-500 dark:text-gray-400"
                  title="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {isEditing ? (
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold mb-2 block">Bagaimana Mood Kamu?</label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {MOODS.map(m => (
                          <button 
                            key={m.label}
                            onClick={() => setEditedMood(m)}
                            className={cn(
                              "p-1.5 sm:p-2 rounded-lg border transition-all duration-300 flex flex-col items-center gap-1 group",
                              editedMood.label === m.label 
                                ? "bg-emerald-50 border-emerald-400 text-emerald-600" 
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-200"
                            )}
                          >
                            <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform">{m.emoji}</span>
                            <span className="text-[6px] sm:text-[7px] uppercase tracking-tighter text-center leading-none">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold mb-1.5 block">Judul Jurnal</label>
                      <input 
                        value={editedTitle} 
                        onChange={e => {
                          setEditedTitle(e.target.value);
                          if (errors.title) setErrors({...errors, title: undefined});
                        }}
                        className={cn(
                          "w-full bg-gray-50 dark:bg-gray-800 border rounded-lg px-3 py-2 outline-none transition-all text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
                          errors.title ? "border-red-500/30 focus:border-red-500/50" : "border-gray-200 focus:border-emerald-400"
                        )}
                      />
                      {errors.title && <p className="text-[8px] text-red-500/80 mt-1 ml-1">{errors.title}</p>}
                    </div>

                    <div>
                      <label className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold mb-1.5 block">Cerita Harimu</label>
                      <textarea 
                        value={editedBody} 
                        onChange={e => {
                          setEditedBody(e.target.value);
                          if (errors.body) setErrors({...errors, body: undefined});
                        }}
                        className={cn(
                          "w-full bg-gray-50 dark:bg-gray-800 border rounded-lg p-3 min-h-30 sm:min-h-37.5 outline-none text-gray-700 dark:text-gray-200 leading-relaxed transition-all resize-none text-xs sm:text-sm",
                          errors.body ? "border-red-500/30 focus:border-red-500/50" : "border-gray-200 focus:border-emerald-400"
                        )}
                      />
                      {errors.body && <p className="text-[8px] text-red-500/80 mt-1 ml-1">{errors.body}</p>}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                     <h5 className="text-[9px] sm:text-[10px] text-[#10b981] font-bold uppercase tracking-widest flex items-center gap-2">
                       <Smile size={12} /> Edit Refleksi
                     </h5>
                     <div className="grid gap-3">
                       <RefInput label="Pelajaran hari ini?" value={editedRef1} onChange={setEditedRef1} />
                       <RefInput label="Perbaikan besok?" value={editedRef2} onChange={setEditedRef2} />
                       <RefInput label="Rasa syukur?" value={editedRef3} onChange={setEditedRef3} />
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleUpdate}
                      disabled={saving}
                      className="flex-2 py-3 px-4 rounded-xl bg-[#10b981] text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="text-2xl sm:text-3xl w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                      {entry.mood}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-base sm:text-lg font-bold truncate">{entry.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
                          {new Date(entry.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <span className="flex items-center gap-1 text-[9px] text-[#10b981] font-mono">
                          <Eye size={10} /> {viewCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                     {isOwner ? (
                       REACTION_TYPES.map(rt => {
                         const count = reactions.filter(r => r.type === rt.type).length;
                         const active = reactions.some(r => r.type === rt.type && r.userId === currentSessionUser.id);
                         const hasReacted = reactions.some(r => r.userId === currentSessionUser.id);

                         return (
                           <ReactionButton 
                             key={rt.type}
                             type={rt.type} 
                             emoji={rt.emoji} 
                             count={count} 
                             active={active}
                             disabled={hasReacted}
                             onClick={() => addReaction(rt.type)} 
                           />
                         );
                       })
                     ) : (
                       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                         <Lock size={10} className="text-gray-300 dark:text-gray-600" />
                         <span className="text-[9px] text-gray-300 dark:text-gray-600 uppercase tracking-widest">Reaksi hanya untuk pemilik</span>
                       </div>
                     )}
                  </div>

                  <div className="text-gray-700 dark:text-gray-200 leading-relaxed text-sm whitespace-pre-wrap py-2">
                    {entry.body}
                  </div>

                  {(entry.ref1 || entry.ref2 || entry.ref3) && (
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <h5 className="text-[9px] sm:text-[10px] text-[#10b981] font-bold uppercase tracking-widest flex items-center gap-2">
                        <Smile size={12} /> Refleksi Diri
                      </h5>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {entry.ref1 && <RefBox label="Pelajaran" text={entry.ref1} />}
                        {entry.ref2 && <RefBox label="Perbaikan" text={entry.ref2} />}
                        {entry.ref3 && <RefBox label="Rasa Syukur" text={entry.ref3} />}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isEditing && (
              <CommentSection 
                entryId={entry.id} 
                comments={comments} 
                onCommentAdded={fetchComments}
                onCommentDeleted={fetchComments}
                loading={loadingComments}
                canInteract={isOwner}
              />
            )}
          </motion.div>
          <ConfirmModal 
            open={confirmData.open}
            onClose={() => setConfirmData(prev => ({ ...prev, open: false }))}
            onConfirm={confirmData.onConfirm}
            title={confirmData.title}
            message={confirmData.message}
            isAlert={confirmData.isAlert}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

function RefBox({ label, text }: { label: string, text: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 sm:p-4 h-full">
      <div className="text-[7px] sm:text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1.5 sm:mb-2">{label}</div>
      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">{text}</p>
    </div>
  );
}

function CommentSection({ entryId, comments, onCommentAdded, onCommentDeleted, loading, canInteract = true }: { 
  entryId: string, 
  comments: Comment[], 
  onCommentAdded: () => void,
  onCommentDeleted: () => void,
  loading: boolean,
  canInteract?: boolean
}) {
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmData, setConfirmData] = useState<{open: boolean, onConfirm: () => void, title: string, message: string, isAlert?: boolean}>({
    open: false,
    onConfirm: () => {},
    title: "",
    message: ""
  });
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      await apiFetch(`/api/journals/${entryId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment })
      });
      setNewComment("");
      onCommentAdded();
    } catch (err: any) {
      setConfirmData({
        open: true,
        title: "Gagal Mengirim",
        message: err.message,
        isAlert: true,
        onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
      } as any);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setConfirmData({
      open: true,
      title: "Hapus Komentar",
      message: "Apakah Anda yakin ingin menghapus komentar ini?",
      onConfirm: async () => {
        try {
          await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" });
          setConfirmData(prev => ({ ...prev, open: false }));
          onCommentDeleted();
        } catch (err: any) {
          setConfirmData({
            open: true,
            title: "Gagal Menghapus",
            message: err.message,
            isAlert: true,
            onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
          } as any);
        }
      }
    });
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
      <h5 className="text-[9px] sm:text-[10px] text-[#10b981] font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
        <MessageCircle size={12} /> Komentar ({comments.length})
      </h5>

      <div className="space-y-4 mb-4">
        {loading && comments.length === 0 ? (
          <div className="flex justify-center p-3">
            <Activity size={14} className="animate-spin text-gray-300 dark:text-gray-600" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">Belum ada komentar.</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-2.5 group">
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                {c.user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">{c.user.name}</span>
                    {c.user.role === "ADMIN" && <span className="text-[7px] bg-emerald-100 text-emerald-600 px-1 rounded uppercase font-bold tracking-tighter">Admin</span>}
                  </div>
                  <span className="text-[7px] text-gray-200 dark:text-gray-700 uppercase font-mono">{new Date(c.createdAt).toLocaleString("id-ID", { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2 rounded-lg rounded-tl-none relative group">
                  <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">{c.body}</p>
                  {(currentUser.id === c.userId || currentUser.role === "ADMIN") && (
                    <button 
                      onClick={() => handleDeleteComment(c.id)}
                      className="absolute top-1.5 right-1.5 p-1 hover:bg-red-500/10 text-gray-100 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handlePostComment} className="flex gap-2">
        {canInteract ? (
          <>
            <input 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Tinggalkan catatan atau refleksi..."
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button 
              disabled={submitting || !newComment.trim()}
              className="w-10 h-10 bg-[#10b981] flex items-center justify-center rounded-xl text-white disabled:opacity-30 transition-all active:scale-95"
            >
              {submitting ? <Activity size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
            <Lock size={10} className="text-gray-300 dark:text-gray-600 shrink-0" />
            <span className="text-[9px] text-gray-300 dark:text-gray-600 uppercase tracking-widest">Komentar hanya untuk pemilik jurnal</span>
          </div>
        )}
      </form>
      <ConfirmModal 
        open={confirmData.open}
        onClose={() => setConfirmData(prev => ({ ...prev, open: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        isAlert={confirmData.isAlert}
      />
    </div>
  );
}

function WritePage({ user, onSave }: { user: User, onSave: () => void }) {
  const [mood, setMood] = useState(MOODS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [ref3, setRef3] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{title?: string, body?: string}>({});
  const [confirmData, setConfirmData] = useState<{open: boolean, onConfirm: () => void, title: string, message: string, isAlert?: boolean}>({
    open: false,
    onConfirm: () => {},
    title: "",
    message: ""
  });

  const validate = () => {
    const newErrors: {title?: string, body?: string} = {};
    if (!title.trim()) newErrors.title = "Judul wajib diisi";
    else if (title.length < 5) newErrors.title = "Judul minimal 5 karakter agar bermakna";
    
    if (!body.trim()) newErrors.body = "Cerita harimu wajib diisi";
    else if (body.length < 20) newErrors.body = "Tuliskan setidaknya 20 karakter untuk refleksi yang lebih baik";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiFetch("/api/journals", {
        method: "POST",
        body: JSON.stringify({ 
          title, 
          body, 
          mood: mood.emoji, 
          moodLabel: mood.label,
          ref1,
          ref2,
          ref3
        })
      });
      onSave();
    } catch (err: any) {
      setConfirmData({
        open: true,
        title: "Gagal Menyimpan",
        message: err.message,
        isAlert: true,
        onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
      } as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6 pb-8">
      <header>
        <h2 className="font-serif text-lg sm:text-xl font-bold mb-0.5">Tulis Jurnal</h2>
        <p className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs">Abadikan momen dan refleksimu hari ini.</p>
      </header>

      <section className="space-y-4 sm:space-y-6">
        <div>
          <label className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold mb-3 block">Bagaimana Mood Kamu?</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {MOODS.map(m => (
              <button 
                key={m.label}
                onClick={() => setMood(m)}
                className={cn(
                  "p-2 sm:p-2.5 rounded-xl border transition-all duration-300 flex flex-col items-center gap-0.5 group relative",
                  mood.label === m.label 
                    ? "bg-emerald-50 border-emerald-400 text-emerald-600 shadow-sm" 
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-200 shadow-sm"
                )}
              >
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{m.emoji}</span>
                <span className="text-[7px] sm:text-[8px] uppercase tracking-tighter text-center leading-none">{m.label}</span>
                {mood.label === m.label && (
                  <motion.div layoutId="mood-active" className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                    <Check size={6} className="text-white bold" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1">
            <label className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold ml-1 block">Judul Jurnal</label>
            <input 
              placeholder="Berikan judul..."
              value={title} 
              onChange={e => {
                setTitle(e.target.value);
                if (errors.title) setErrors({...errors, title: undefined});
              }}
              className={cn(
                "w-full bg-white dark:bg-gray-800 border rounded-xl px-4 py-2.5 outline-none transition-all font-medium text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
                errors.title ? "border-red-500/30 focus:border-red-500/50" : "border-gray-200 focus:border-emerald-400"
              )}
            />
            {errors.title && <p className="text-[9px] text-red-500/80 mt-1 ml-1.5 font-medium">{errors.title}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold ml-1 block">Cerita Harimu</label>
            <textarea 
              placeholder="Tuliskan detail..."
              value={body} 
              onChange={e => {
                setBody(e.target.value);
                if (errors.body) setErrors({...errors, body: undefined});
              }}
              className={cn(
                "w-full bg-white dark:bg-gray-800 border rounded-xl p-4 min-h-30 sm:min-h-40 outline-none text-gray-700 dark:text-gray-200 leading-relaxed transition-all resize-none text-xs sm:text-sm",
                errors.body ? "border-red-500/30 focus:border-red-500/50" : "border-gray-200 focus:border-emerald-400"
              )}
            />
            {errors.body && <p className="text-[9px] text-red-500/80 mt-1 ml-1.5 font-medium">{errors.body}</p>}
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <h4 className="text-[11px] sm:text-xs font-serif font-bold text-[#10b981] mb-3 flex items-center gap-2 uppercase tracking-widest">
              <Smile size={14} /> Refleksi Terpandu
            </h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <RefInput label="Pelajaran hari ini?" value={ref1} onChange={setRef1} />
              <RefInput label="Perbaikan besok?" value={ref2} onChange={setRef2} />
              <RefInput label="Rasa syukur?" value={ref3} onChange={setRef3} />
            </div>
          </div>

          <button 
            disabled={saving}
            onClick={handleSave}
            className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-emerald-200/60 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2 text-xs"
          >
            {saving ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Menyimpan Jurnal..." : "Simpan Refleksi Harian"}
          </button>
        </div>
      </section>

      <ConfirmModal 
        open={confirmData.open}
        onClose={() => setConfirmData(prev => ({ ...prev, open: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        isAlert={confirmData.isAlert}
      />
    </motion.div>
  );
}

function RefInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 group focus-within:border-emerald-300 dark:focus-within:border-emerald-600 transition-all shadow-sm">
      <label className="text-[8px] sm:text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1.5 block leading-none">{label}</label>
      <textarea 
        value={value} onChange={e => onChange(e.target.value)}
        placeholder="Tulis refleksi..."
        className="w-full bg-transparent border-none outline-none text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 h-14 sm:h-16 resize-none leading-relaxed"
      />
    </div>
  );
}

function HistoryPage({ user }: { user: User }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [moodFilter, setMoodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const endpoint = user.role === "ADMIN" ? "/api/admin/stats" : "/api/journals";
      const data = await apiFetch(endpoint);
      setEntries(user.role === "ADMIN" ? (data.allEntries || []) : data);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredEntries = entries.filter(e => {
    const matchesMood = moodFilter === "all" || e.mood === moodFilter;
    
    let matchesDate = true;
    const entryDate = new Date(e.createdAt);
    const now = new Date();
    
    if (dateFilter === "weekly") {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = entryDate >= oneWeekAgo;
    } else if (dateFilter === "monthly") {
      matchesDate = entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
    } else if (dateFilter === "yearly") {
      matchesDate = entryDate.getFullYear() === now.getFullYear();
    }

    const matchesSearch = 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.user && (
        e.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.user.nis.includes(searchQuery)
      ));

    return matchesMood && matchesDate && matchesSearch;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header>
        <h2 className="font-serif text-xl sm:text-2xl font-bold mb-0.5">
          {user.role === "ADMIN" ? "Monitoring Riwayat Siswa" : "Riwayat Jurnal"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-xs text-balance">
          {user.role === "ADMIN" ? "Arsip lengkap seluruh refleksi siswa di ekosistem." : "Arsip lengkap refleksi dirimu."}
        </p>
      </header>

      <div className="space-y-3 sticky top-12 sm:top-14 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md py-3 z-40 border-b border-gray-100 dark:border-gray-800">
        {/* Search Input */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
          <input 
            type="text"
            placeholder="Cari kata kunci..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-400 transition-all font-medium shadow-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Mood Filter */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button 
            onClick={() => setMoodFilter("all")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[8px] sm:text-[9px] uppercase tracking-widest font-bold transition-all border shrink-0", 
              moodFilter === "all" ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-200 hover:text-emerald-600"
            )}
          >
            Semua
          </button>
          {MOODS.map(m => (
            <button 
              key={m.label}
              onClick={() => setMoodFilter(m.emoji)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs sm:text-sm transition-all border shrink-0", 
                moodFilter === m.emoji ? "bg-emerald-50 border-emerald-400 text-emerald-600" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-200"
              )}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex overflow-x-auto sm:flex-wrap gap-1.5 pb-1 sm:pb-0 scrollbar-hide">
          {[
            { id: "all", label: "Semua Waktu" },
            { id: "weekly", label: "7 Hari" },
            { id: "monthly", label: "30 Hari" },
            { id: "yearly", label: "Tahun Ini" }
          ].map(f => (
            <button 
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[8px] sm:text-[9px] uppercase tracking-widest font-bold transition-all border whitespace-nowrap", 
                dateFilter === f.id ? "bg-emerald-50 text-emerald-600 border-emerald-300" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-emerald-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
           Array(5).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-2xl animate-pulse" />)
        ) : filteredEntries.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
            <BookOpen size={30} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-gray-300 dark:text-gray-600 uppercase tracking-[0.2em] text-[10px] font-bold">Tidak ada catatan ditemukan</p>
          </div>
        ) : (
          filteredEntries.map(e => <EntryCard key={e.id} entry={e} onUpdate={fetchHistory} />)
        )}
      </div>
    </motion.div>
  );
}

function KeywordMoodChart({ entries }: { entries: Entry[] }) {
  const commonKeywords = ["belajar", "tugas", "ujian", "teman", "istirahat", "hobi", "olahraga", "keluarga", "proyek", "magang", "makan", "tidur"];
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const chartColors = {
    grid:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axis:   isDark ? '#4b5563' : '#9ca3af',
    cursor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
  };
  const keywordMap: Record<string, { totalScore: number, count: number, emoji: string[] }> = {};

  entries.forEach(e => {
    const text = `${e.title} ${e.body}`.toLowerCase();
    const moodValue = MOODS.find(m => m.emoji === e.mood)?.score || 3;

    commonKeywords.forEach(kw => {
      if (text.includes(kw)) {
        if (!keywordMap[kw]) keywordMap[kw] = { totalScore: 0, count: 0, emoji: [] };
        keywordMap[kw].totalScore += moodValue;
        keywordMap[kw].count += 1;
        if (!keywordMap[kw].emoji.includes(e.mood)) keywordMap[kw].emoji.push(e.mood);
      }
    });
  });

  const correlationData = Object.entries(keywordMap).map(([name, data]) => ({
    name,
    avgMood: Number((data.totalScore / data.count).toFixed(2)),
    frequency: data.count,
    emojis: data.emoji.slice(0, 3).join("")
  })).sort((a, b) => b.frequency - a.frequency);

  if (correlationData.length === 0) return (
    <div className="h-40 flex items-center justify-center text-gray-200 dark:text-gray-700 uppercase tracking-widest text-[10px]">
      Belum ada data korelasi yang cukup
    </div>
  );

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={correlationData} layout="vertical" margin={{ left: isMobile ? 5 : 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={true} vertical={false} />
          <XAxis type="number" domain={[0, 5]} hide />
          <YAxis dataKey="name" type="category" stroke={chartColors.axis} fontSize={isMobile ? 9 : 11} tickLine={false} axisLine={false} width={isMobile ? 60 : 80} />
          <Tooltip 
            cursor={{ fill: chartColors.cursor }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-2xl">
                    <p className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-1">{data.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">Muncul {data.frequency} kali</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 dark:text-gray-200">Skor Mood:</span>
                      <span className="text-sm font-bold text-[#10b981]">{data.avgMood}</span>
                      <span className="text-lg">{data.emojis}</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="avgMood" radius={[0, 4, 4, 0]}>
            {correlationData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.avgMood >= 4 ? "#4cc9a0" : entry.avgMood >= 3 ? "#10b981" : "#e24b4a"} 
                fillOpacity={0.6 + (entry.frequency / Math.max(...correlationData.map(d => d.frequency))) * 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GrafikPage({ user }: { user: User }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const chartColors = {
    bg:     isDark ? '#111827' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    text:   isDark ? '#d1d5db' : '#374151',
    grid:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axis:   isDark ? '#4b5563' : '#9ca3af',
    cursor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const endpoint = user.role === "ADMIN" ? "/api/admin/stats" : "/api/journals";
        const data = await apiFetch(endpoint);
        setEntries(user.role === "ADMIN" ? (data.allEntries || []) : data);
      } catch (err) {} finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  // Data for BarChart (mood distribution)
  const moodDistribution = MOODS.map(m => ({
    name: m.emoji,
    count: entries.filter(e => e.mood === m.emoji).length,
    color: m.color
  })).filter(d => d.count > 0);

  // Data for LineChart (frequency over time)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });

  const frequencyData = last7Days.map(date => ({
    date: new Date(date).toLocaleDateString("id-ID", { weekday: "short" }),
    count: entries.filter(e => new Date(e.createdAt).toDateString() === date).length
  }));

  // Keyword Performance Analysis
  const getKeywordData = () => {
    const commonKeywords = ["belajar", "tugas", "ujian", "teman", "istirahat", "istirahat", "hobi", "olahraga", "keluarga", "proyek", "magang", "makan", "tidur"];
    const keywordMap: Record<string, { totalScore: number, count: number, emoji: string[] }> = {};

    entries.forEach(e => {
      const text = `${e.title} ${e.body}`.toLowerCase();
      const moodValue = MOODS.find(m => m.emoji === e.mood)?.score || 3;

      commonKeywords.forEach(kw => {
        if (text.includes(kw)) {
          if (!keywordMap[kw]) keywordMap[kw] = { totalScore: 0, count: 0, emoji: [] };
          keywordMap[kw].totalScore += moodValue;
          keywordMap[kw].count += 1;
          if (!keywordMap[kw].emoji.includes(e.mood)) keywordMap[kw].emoji.push(e.mood);
        }
      });
    });

    return Object.entries(keywordMap).map(([name, data]) => ({
      name,
      avgMood: Number((data.totalScore / data.count).toFixed(2)),
      frequency: data.count,
      emojis: data.emoji.slice(0, 3).join("")
    })).sort((a, b) => b.frequency - a.frequency);
  };

  const correlationData = getKeywordData();

  if (loading) return <div className="h-64 flex items-center justify-center text-emerald-600"><Activity className="animate-spin" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12">
      <header>
        <h2 className="font-serif text-xl sm:text-2xl font-bold mb-1">
          {user.role === "ADMIN" ? "Analisis Sentiment Siswa" : "Analisis Mood"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs">
          {user.role === "ADMIN" ? "Visualisasi pola emosional seluruh siswa dalam sistem." : "Visualisasi pola emosional harimu."}
        </p>
      </header>

      <div className="grid gap-4">
        {/* Keyword Correlation Chart */}
        <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Korelasi Mood</h3>
            <span className="text-[8px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">AI Node</span>
          </div>
          <KeywordMoodChart entries={entries} />
        </section>

        {/* Frequency Line Chart */}
        <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-4">Aktivitas (7 Hari)</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frequencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="date" stroke={chartColors.axis} fontSize={9} axisLine={false} tickLine={false} dy={5} />
                <YAxis stroke={chartColors.axis} fontSize={9} axisLine={false} tickLine={false} tickCount={4} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: chartColors.bg, border: `1px solid ${chartColors.border}`, borderRadius: '8px', fontSize: '10px', color: chartColors.text }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Mood Distribution Donut */}
        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
            <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-6">Distribusi Mood</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={moodDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {moodDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: chartColors.bg, border: `1px solid ${chartColors.border}`, borderRadius: '12px' }}
                    labelStyle={{ color: chartColors.text }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
             <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-6">Ringkasan Mood</h3>
             <div className="space-y-4">
                {MOODS.map(m => {
                  const count = entries.filter(e => e.mood === m.emoji).length;
                  const percent = entries.length ? Math.round((count / entries.length) * 100) : 0;
                  return (
                    <div key={m.label} className="flex items-center gap-4">
                      <span className="text-2xl">{m.emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                          <span>{m.label}</span>
                          <span>{count} Jurnal</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="h-full rounded-full" 
                            style={{ backgroundColor: m.color }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-300">{percent}%</span>
                    </div>
                  )
                })}
             </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function ProfilePage({ user, onUpdate }: { user: User, onUpdate: (u: User) => void }) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword && newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name !== user.name ? name : undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        })
      });

      setSuccess("Profil berhasil diperbarui!");
      localStorage.setItem("user", JSON.stringify(data.user));
      onUpdate(data.user);
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <header>
        <h2 className="font-serif text-xl sm:text-2xl font-bold mb-1 text-[#10b981]">Pengaturan Profil</h2>
        <p className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Kelola Identitas & Keamanan Akun</p>
      </header>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold block">Informasi Dasar</label>
            <div className="grid gap-4">
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block">Nama Lengkap</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all font-medium shadow-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block">NIS (Tidak dapat diubah)</label>
                <input 
                  value={user.nis} 
                  disabled
                  className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-sm outline-none text-gray-400 dark:text-gray-600 cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
            <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-bold block">Ubah Password</label>
            <p className="text-[9px] text-gray-500 dark:text-gray-400 italic">Kosongkan jika tidak ingin mengubah password.</p>
            
            <div className="grid gap-4">
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block">Password Saat Ini</label>
                <input 
                  type="password"
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all shadow-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block">Password Baru</label>
                  <input 
                    type="password"
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all shadow-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 block">Konfirmasi Password Baru</label>
                  <input 
                    type="password"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all shadow-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-3">
              <Check size={14} className="text-green-400" />
              <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold">{success}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {submitting ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan Perubahan Profil
          </button>
        </form>
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center justify-between group">
        <div>
          <h4 className="text-xs font-bold text-red-400/80 mb-1 group-hover:text-red-400 transition-colors">Zona Bahaya</h4>
          <p className="text-[9px] text-gray-300 dark:text-gray-600 uppercase tracking-tighter">Hubungi Admin jika Anda ingin menghapus akun ini.</p>
        </div>
        <UserX size={20} className="text-red-500/20 group-hover:text-red-500/40 transition-colors" />
      </div>
    </motion.div>
  );
}
function ConfirmModal({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Konfirmasi",
  confirmVariant = "danger",
  isAlert = false
}: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 w-full max-w-75 shadow-2xl shadow-gray-300/30 dark:shadow-gray-950"
      >
        <div className={cn(
          "flex items-center gap-3 mb-3",
          confirmVariant === "danger" ? "text-red-500 dark:text-red-400" : (confirmVariant === "warning" ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")
        )}>
          {isAlert ? <AlertCircle size={20} /> : <AlertCircle size={20} />}
          <h3 className="font-serif text-lg font-bold">{title}</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-xs mb-5 leading-relaxed text-balance">
          {message}
        </p>
        <div className="flex gap-2">
          {!isAlert && (
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Batal
            </button>
          )}
          <button 
            onClick={onConfirm || onClose}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
              confirmVariant === "danger" ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20" : 
              (confirmVariant === "warning" ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20" : 
              "bg-[#10b981] text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200/60")
            )}
          >
            {isAlert ? "Tutup" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminMonitor({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const chartColors = {
    bg:     isDark ? '#111827' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    text:   isDark ? '#d1d5db' : '#374151',
    grid:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    axis:   isDark ? '#4b5563' : '#9ca3af',
  };
  const [errorStats, setErrorStats] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState("dashboard");
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmData, setConfirmData] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "warning" | "success";
    label: string;
    isAlert?: boolean;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger",
    label: "Hapus",
    isAlert: false
  });
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/api/admin/stats");
      setStats(data);
      setErrorStats(null);
    } catch (err: any) {
      console.error("Admin Stats Error:", err.message);
      setErrorStats(err.message);
    } finally {
      setLoadingStats(false);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    setConfirmData({
      open: true,
      title: "Hapus Siswa",
      message: `Apakah Anda yakin ingin menghapus permanen data siswa "${name}"? Seluruh riwayat jurnal dan log aktivitas siswa ini juga akan dihapus selamanya.`,
      label: "Hapus Permanen",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
          setConfirmData(prev => ({ ...prev, open: false }));
          fetchStats();
        } catch (err: any) {
          setConfirmData({
            open: true,
            title: "Gagal",
            message: err.message,
            isAlert: true,
            onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
          } as any);
        }
      }
    });
  };

  const toggleUserStatus = async (id: string, name: string, currentStatus: string) => {
    const isActivating = currentStatus === "INACTIVE";
    setConfirmData({
      open: true,
      title: isActivating ? "Aktifkan Akun" : "Nonaktifkan Akun",
      message: isActivating 
        ? `Aktifkan kembali akun "${name}" agar siswa dapat masuk ke Jurnal Self Acceptance?`
        : `Nonaktifkan akun "${name}"? Siswa tidak akan bisa masuk ke aplikasi sampai diaktifkan kembali.`,
      label: isActivating ? "Aktifkan" : "Nonaktifkan",
      variant: "warning",
      onConfirm: async () => {
        const newStatus = isActivating ? "ACTIVE" : "INACTIVE";
        try {
          await apiFetch(`/api/admin/users/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
          });
          setConfirmData(prev => ({ ...prev, open: false }));
          fetchStats();
        } catch (err: any) {
          setConfirmData({
            open: true,
            title: "Gagal",
            message: err.message,
            isAlert: true,
            onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
          } as any);
        }
      }
    });
  };

  const exportToExcel = async () => {
    if (!stats || !stats.allEntries) return;
    setExporting(true);

    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Jurnal Self Acceptance";
      wb.created = new Date();

      const ORANGE = "FFCD7F3F";
      const ORANGE_LIGHT = "FFFFF3E8";
      const DARK_BG = "FF1A1D27";
      const WHITE = "FFFFFFFF";
      const GRAY_HEADER = "FF2C2F3E";
      const GRAY_ROW_ALT = "FFF5F5F5";

      const styleHeader = (row: import('exceljs').Row, bgColor = GRAY_HEADER) => {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          cell.font = { bold: true, color: { argb: bgColor === GRAY_HEADER ? WHITE : "FF1A1D27" }, size: 10 };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD0D0D0" } },
            bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
            left: { style: "thin", color: { argb: "FFD0D0D0" } },
            right: { style: "thin", color: { argb: "FFD0D0D0" } },
          };
        });
        row.height = 28;
      };

      const styleDataRow = (row: import('exceljs').Row, isAlt: boolean) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? GRAY_ROW_ALT : WHITE } };
          cell.font = { size: 9, color: { argb: "FF333333" } };
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE0E0E0" } },
            left: { style: "hair", color: { argb: "FFE0E0E0" } },
            right: { style: "hair", color: { argb: "FFE0E0E0" } },
          };
        });
        row.height = 18;
      };

      const addSheetTitle = (ws: import('exceljs').Worksheet, title: string, subtitle: string, colCount: number) => {
        ws.mergeCells(1, 1, 1, colCount);
        const titleRow = ws.getRow(1);
        titleRow.getCell(1).value = title;
        titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
        titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: WHITE } };
        titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        titleRow.height = 36;

        ws.mergeCells(2, 1, 2, colCount);
        const subRow = ws.getRow(2);
        subRow.getCell(1).value = subtitle;
        subRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_LIGHT } };
        subRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF888888" } };
        subRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        subRow.height = 20;

        ws.addRow([]);
      };

      const exportDate = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });

      // =====================
      // SHEET 1: RINGKASAN
      // =====================
      const wsRingkasan = wb.addWorksheet("Ringkasan", { properties: { tabColor: { argb: ORANGE } } });
      wsRingkasan.columns = [
        { key: "a", width: 30 },
        { key: "b", width: 25 },
        { key: "c", width: 20 },
        { key: "d", width: 20 },
      ];
      addSheetTitle(wsRingkasan, "Jurnal Self Acceptance — Laporan Ekspor", `Diekspor pada: ${exportDate}`, 4);

      const moodCount: Record<string, number> = {};
      stats.allEntries.forEach((e: any) => {
        const label = e.moodLabel || e.mood || "Tidak diketahui";
        moodCount[label] = (moodCount[label] || 0) + 1;
      });
      const todayStr = new Date().toDateString();
      const jurnalHariIni = stats.allEntries.filter((e: any) => new Date(e.createdAt).toDateString() === todayStr).length;
      const totalReaksi = stats.allEntries.reduce((acc: number, e: any) => acc + (e.reactions?.length || 0), 0);
      const totalKomentar = stats.allEntries.reduce((acc: number, e: any) => acc + (e._count?.comments || 0), 0);

      const summaryData = [
        ["STATISTIK UMUM", "", "", ""],
        ["Total Siswa Aktif", stats.totalUsers, "", ""],
        ["Total Jurnal Tercatat", stats.totalEntries, "", ""],
        ["Jurnal Dibuat Hari Ini", jurnalHariIni, "", ""],
        ["Total Reaksi", totalReaksi, "", ""],
        ["Total Komentar", totalKomentar, "", ""],
        ["Log Audit (50 terbaru)", stats.recentLogs?.length || 0, "", ""],
        ["", "", "", ""],
        ["DISTRIBUSI MOOD", "", "", ""],
        ...Object.entries(moodCount).map(([mood, count]) => [mood, count, `${((count / stats.totalEntries) * 100).toFixed(1)}%`, ""]),
      ];

      summaryData.forEach((rowData, idx) => {
        const row = wsRingkasan.addRow(rowData);
        if (rowData[0] === "STATISTIK UMUM" || rowData[0] === "DISTRIBUSI MOOD") {
          row.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
            cell.font = { bold: true, color: { argb: ORANGE.replace("FF", "") }, size: 9, italic: true };
          });
          row.height = 20;
        } else if (rowData[0] !== "") {
          styleDataRow(row, idx % 2 === 0);
          row.getCell(1).font = { bold: true, size: 9 };
          row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      // =====================
      // SHEET 2: JURNAL SISWA
      // =====================
      const wsJurnal = wb.addWorksheet("Jurnal Siswa", { properties: { tabColor: { argb: "FF4CC9A0" } } });
      wsJurnal.columns = [
        { key: "no", header: "No", width: 6 },
        { key: "nis", header: "NIS", width: 14 },
        { key: "nama", header: "Nama Siswa", width: 22 },
        { key: "mood", header: "Mood", width: 8 },
        { key: "moodLabel", header: "Label Mood", width: 18 },
        { key: "judul", header: "Judul Jurnal", width: 28 },
        { key: "isi", header: "Isi Jurnal", width: 50 },
        { key: "ref1", header: "Refleksi 1", width: 30 },
        { key: "ref2", header: "Refleksi 2", width: 30 },
        { key: "ref3", header: "Refleksi 3", width: 30 },
        { key: "reaksi", header: "Reaksi", width: 10 },
        { key: "komentar", header: "Komentar", width: 10 },
        { key: "viewCount", header: "Views", width: 8 },
        { key: "tanggal", header: "Tanggal Dibuat", width: 22 },
      ];

      addSheetTitle(wsJurnal, "Data Jurnal Siswa", `Total: ${stats.allEntries.length} jurnal · Diekspor: ${exportDate}`, 14);
      const hJurnal = wsJurnal.addRow(wsJurnal.columns.map((c: any) => c.header));
      styleHeader(hJurnal, GRAY_HEADER);

      stats.allEntries.forEach((e: any, i: number) => {
        const row = wsJurnal.addRow({
          no: i + 1,
          nis: e.user?.nis || "N/A",
          nama: e.user?.name || "Unknown",
          mood: e.mood || "",
          moodLabel: e.moodLabel || "",
          judul: e.title || "",
          isi: e.body || "",
          ref1: e.ref1 || "",
          ref2: e.ref2 || "",
          ref3: e.ref3 || "",
          reaksi: e.reactions?.length || 0,
          komentar: e._count?.comments || 0,
          viewCount: e.viewCount || 0,
          tanggal: new Date(e.createdAt).toLocaleString("id-ID"),
        });
        styleDataRow(row, i % 2 !== 0);
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(12).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(13).alignment = { horizontal: "center", vertical: "middle" };
      });

      wsJurnal.views = [{ state: "frozen", ySplit: 4 }];

      // =====================
      // SHEET 3: DAFTAR SISWA
      // =====================
      const wsSiswa = wb.addWorksheet("Daftar Siswa", { properties: { tabColor: { argb: "FF4A9EDB" } } });
      wsSiswa.columns = [
        { key: "no", header: "No", width: 6 },
        { key: "nis", header: "NIS", width: 16 },
        { key: "nama", header: "Nama Lengkap", width: 28 },
        { key: "status", header: "Status", width: 14 },
        { key: "totalJurnal", header: "Total Jurnal", width: 14 },
        { key: "terdaftar", header: "Tanggal Daftar", width: 22 },
      ];

      addSheetTitle(wsSiswa, "Daftar Siswa Terdaftar", `Total: ${stats.allUsers?.length || 0} siswa · Diekspor: ${exportDate}`, 6);
      const hSiswa = wsSiswa.addRow(wsSiswa.columns.map((c: any) => c.header));
      styleHeader(hSiswa, GRAY_HEADER);

      (stats.allUsers || []).forEach((u: any, i: number) => {
        const totalJurnal = stats.allEntries.filter((e: any) => e.user?.nis === u.nis).length;
        const row = wsSiswa.addRow({
          no: i + 1,
          nis: u.nis,
          nama: u.name,
          status: u.status === "ACTIVE" ? "Aktif" : "Nonaktif",
          totalJurnal,
          terdaftar: new Date(u.createdAt).toLocaleString("id-ID"),
        });
        styleDataRow(row, i % 2 !== 0);
        const statusCell = row.getCell(4);
        statusCell.font = { bold: true, size: 9, color: { argb: u.status === "ACTIVE" ? "FF2E7D32" : "FFC62828" } };
        statusCell.alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      });

      wsSiswa.views = [{ state: "frozen", ySplit: 4 }];

      // =====================
      // SHEET 4: AUDIT LOG
      // =====================
      const wsLog = wb.addWorksheet("Audit Log", { properties: { tabColor: { argb: "FFDC2626" } } });
      wsLog.columns = [
        { key: "no", header: "No", width: 6 },
        { key: "waktu", header: "Waktu", width: 22 },
        { key: "pengguna", header: "Pengguna", width: 24 },
        { key: "aksi", header: "Aksi", width: 22 },
        { key: "detail", header: "Detail", width: 50 },
      ];

      addSheetTitle(wsLog, "Audit Log Sistem", `50 aktivitas terbaru · Diekspor: ${exportDate}`, 5);
      const hLog = wsLog.addRow(wsLog.columns.map((c: any) => c.header));
      styleHeader(hLog, "FFDC2626");

      (stats.recentLogs || []).forEach((log: any, i: number) => {
        const row = wsLog.addRow({
          no: i + 1,
          waktu: new Date(log.createdAt).toLocaleString("id-ID"),
          pengguna: log.user?.name || "System",
          aksi: log.action || "",
          detail: log.details || "",
        });
        styleDataRow(row, i % 2 !== 0);
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      });

      wsLog.views = [{ state: "frozen", ySplit: 4 }];

      // =====================
      // WRITE & DOWNLOAD
      // =====================
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Jurnal Self Acceptance_Laporan_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setConfirmData({
        open: true,
        title: "Gagal Ekspor",
        message: String(err),
        isAlert: true,
        onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
      } as any);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { 
    if (user.role === "ADMIN") {
      fetchStats();
      const interval = setInterval(fetchStats, 10000); // 10s for admin
      return () => clearInterval(interval);
    }
  }, [user]);

  if (loadingStats && !stats) return (
    <div className="h-64 flex flex-col items-center justify-center gap-4 text-gray-300 dark:text-gray-600">
      <Activity className="animate-spin text-[#10b981]" />
      <p className="text-xs uppercase tracking-widest">Menghubungkan ke pusat data...</p>
    </div>
  );

  if (errorStats && !stats) return (
    <div className="h-64 flex flex-col items-center justify-center gap-4 text-red-500/50">
      <AlertCircle size={32} />
      <p className="text-xs uppercase tracking-widest text-center">Gagal memuat data: {errorStats}</p>
      <button onClick={() => { setLoadingStats(true); fetchStats(); }} className="text-[10px] underline hover:text-red-400">Coba Lagi</button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-2">
            <ShieldCheck className="text-[#10b981] shrink-0" size={24} /> Panel Monitoring
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm tracking-wide">Monitoring real-time Jurnal Harian Siswa.</p>
        </div>
        <button 
          onClick={exportToExcel}
          disabled={exporting}
          className="flex items-center justify-center gap-2 bg-emerald-100 border border-emerald-300 text-[#10b981] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#10b981]/20 transition-all h-10"
        >
          {exporting ? <Activity size={14} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          Export Excel
        </button>
      </header>

      {/* Sub-Tabs Navigation */}
      <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar shadow-inner">
        {[
          { id: "dashboard", label: "Overview", icon: Grid },
          { id: "siswa", label: "Siswa", icon: UserIcon },
          { id: "jurnal", label: "Semua Jurnal", icon: BookOpen },
          { id: "kuesioner", label: "Kuesioner", icon: ClipboardList },
          { id: "logs", label: "Logs", icon: Activity },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap",
              activeSubTab === t.id ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "dashboard" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Siswa" value={stats.totalUsers - 1} unit="Aktif" />
              <StatCard label="Total Jurnal" value={stats.totalEntries} unit="Tercatat" />
              <StatCard label="Jurnal Baru" value={stats.allEntries.filter((e: any) => new Date(e.createdAt).toDateString() === new Date().toDateString()).length} unit="Hari Ini" />
              <StatCard label="Logs Audit" value={stats.recentLogs.length} unit="History" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold uppercase tracking-widest text-xs text-gray-400 dark:text-gray-500">Keyword Analysis</h3>
                  <span className="text-[10px] text-[#10b981] font-bold">SENTIMAN GLOBAL</span>
                </div>
                <KeywordMoodChart entries={stats.allEntries} />
              </section>

              <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                 <h3 className="font-bold uppercase tracking-widest text-xs text-gray-400 dark:text-gray-500 mb-6">Distribusi Mood Siswa</h3>
                 <div className="h-80 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={MOODS.map(m => ({
                           name: m.label,
                           value: stats.allEntries.filter((e: any) => e.mood === m.emoji).length
                         })).filter(d => d.value > 0)}
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         {MOODS.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ backgroundColor: chartColors.bg, border: `1px solid ${chartColors.border}`, borderRadius: '12px' }}
                         labelStyle={{ color: chartColors.text }}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
              </section>
            </div>
          </motion.div>
        )}

        {activeSubTab === "siswa" && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <UserIcon size={18} className="text-[#4cc9a0]" />
                <h3 className="font-bold uppercase tracking-widest text-xs">Manajemen Siswa</h3>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                <input 
                  type="text" 
                  placeholder="Cari Nama/NIS..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-400 dark:focus:border-emerald-500 text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4">NIS</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Bergabung</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(stats.allUsers || []).filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.nis.includes(searchTerm)).map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs">
                      <td className="px-6 py-4">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-[10px] text-gray-300 dark:text-gray-600">Student Account</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">{u.nis}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                          u.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                        )}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 dark:text-gray-500">{new Date(u.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleUserStatus(u.id, u.name, u.status)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              u.status === "ACTIVE" ? "hover:bg-red-500/10 text-red-400/40 hover:text-red-400 dark:hover:text-red-400" : "hover:bg-green-500/10 text-green-400/40 hover:text-green-400"
                            )}
                            title={u.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {u.status === "ACTIVE" ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                          <button 
                            onClick={() => deleteUser(u.id, u.name)}
                            className="p-2 hover:bg-red-500/10 text-gray-200 dark:text-gray-700 hover:text-red-500 rounded-lg transition-all"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeSubTab === "jurnal" && (
          <motion.div key="journals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-6 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-2">
                 <BookOpen size={18} className="text-[#10b981]" />
                 <h3 className="font-bold uppercase tracking-widest text-xs">Arsip Seluruh Jurnal Siswa</h3>
               </div>
               <div className="relative w-64">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                <input 
                  type="text" 
                  placeholder="Cari Jurnal/Nama/NIS..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-400 dark:focus:border-emerald-500 text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
            <div className="grid gap-3">
              {(stats.allEntries || [])
                .filter((e: any) => 
                  e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  e.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  e.user?.nis.includes(searchTerm)
                ).map((e: any) => (
                <div 
                  key={e.id} 
                  onClick={() => setSelectedEntry(e)}
                  className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 hover:border-emerald-300 transition-all group relative cursor-pointer"
                >
                   <div className="flex items-start gap-4">
                      <div className="text-3xl p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 group-hover:border-emerald-300 transition-all">
                        {e.mood}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-sm text-[#10b981] truncate pr-8">{e.title}</h4>
                            <span className="text-[9px] text-gray-300 dark:text-gray-600 uppercase font-mono">{new Date(e.createdAt).toLocaleString("id-ID")}</span>
                         </div>
                         <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[8px] font-bold text-emerald-600 uppercase">{e.user?.name?.[0]}</div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{e.user?.name} · {e.user?.nis}</span>
                         </div>
                         <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed mb-3 italic">"{e.body}"</p>
                         
                         <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex flex-wrap gap-2">
                               {e.ref1 && <span className="text-[8px] bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Refleksi Aktif</span>}
                               {e.moodLabel && <span className="text-[8px] bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-400 dark:text-gray-500 uppercase tracking-tighter">{e.moodLabel}</span>}
                               <div className="flex items-center gap-2 text-[8px] text-gray-300 dark:text-gray-600 font-mono ml-2">
                                 <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><Eye size={8} className="text-[#10b981]" /> {e.viewCount || 0}</span>
                                 <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><MessageCircle size={8} className="text-[#4cc9a0]" /> {e._count?.comments || 0}</span>
                                 <span className="flex items-center gap-0.5 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800"><Smile size={8} className="text-pink-400" /> {e.reactions?.length || 0}</span>
                               </div>
                            </div>
                            <button 
                              onClick={(evt) => {
                                evt.stopPropagation();
                                setConfirmData({
                                  open: true,
                                  title: "Hapus Jurnal",
                                  message: `Apakah Anda yakin ingin menghapus jurnal "${e.title}" milik ${e.user?.name}? Tindakan ini tidak dapat dibatalkan.`,
                                  label: "Hapus Jurnal",
                                  variant: "danger",
                                  onConfirm: async () => {
                                    try {
                                      await apiFetch(`/api/journals/${e.id}`, { method: "DELETE" });
                                      setConfirmData(prev => ({ ...prev, open: false }));
                                      fetchStats();
                                    } catch (err: any) {
                                      setConfirmData({
                                        open: true,
                                        title: "Gagal",
                                        message: err.message,
                                        isAlert: true,
                                        onConfirm: () => setConfirmData(prev => ({ ...prev, open: false }))
                                      } as any);
                                    }
                                  }
                                });
                              }}
                              className="p-2 hover:bg-red-500/10 text-gray-200 dark:text-gray-700 hover:text-red-500 rounded-lg transition-all"
                              title="Hapus Jurnal"
                            >
                              <Trash2 size={14} />
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSubTab === "kuesioner" && (
          <motion.div key="kuesioner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <AdminKuesionerPanel />
          </motion.div>
        )}

        {activeSubTab === "logs" && (
           <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" />
                  <h3 className="font-bold uppercase tracking-widest text-xs">Live System Logs</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Auto Monitoring</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-150 bg-white dark:bg-gray-900">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 z-10">
                    <tr>
                      <th className="px-6 py-4">Waktu</th>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.recentLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-[10px] font-mono">
                        <td className="px-6 py-4 text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                        <td className="px-6 py-4 font-bold text-[#10b981]">{log.user?.name?.split(' ')[0] || "System"}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter",
                            log.action === "LOGIN" ? "bg-blue-500/10 text-blue-400" : 
                            log.action.includes("CREATE") ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 truncate max-w-sm">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        open={confirmData.open}
        onClose={() => setConfirmData(prev => ({ ...prev, open: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel={confirmData.label}
        confirmVariant={confirmData.variant === "danger" ? "danger" : (confirmData.variant === "warning" ? "warning" : "info")}
        isAlert={confirmData.isAlert}
      />

      {selectedEntry && (
        <JournalDetailModal 
          entry={selectedEntry}
          open={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onUpdate={fetchStats}
          canEdit={false}
        />
      )}
    </motion.div>
  );
}

function StatCard({ label, value, unit, className }: any) {
  return (
    <div className={cn("bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md dark:hover:shadow-none transition-all hover:border-emerald-100 dark:hover:border-emerald-900 flex flex-col justify-between h-full", className)}>
      <div className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight leading-none">{value}</div>
        {unit && <div className="text-[9px] sm:text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">{unit}</div>}
      </div>
    </div>
  );
}

// ===== ADMIN KUESIONER PANEL =====
function AdminKuesionerPanel() {
  const [list, setList] = useState<Kuesioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Kuesioner | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmData, setConfirmData] = useState<any>({ open: false });

  const fetchKuesioner = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/kuesioner");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("AdminKuesionerPanel fetch error:", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKuesioner(); }, []);

  if (selected) return (
    <AdminKuesionerDetail
      kuesioner={selected}
      onBack={() => { setSelected(null); fetchKuesioner(); }}
      onRefresh={fetchKuesioner}
    />
  );

  const STATUS_STYLE: Record<StatusKuesioner, string> = {
    DRAFT: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    AKTIF: "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400",
    TUTUP: "bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400",
  };

  const toggleStatus = async (k: Kuesioner) => {
    const next: Record<StatusKuesioner, StatusKuesioner> = { DRAFT: "AKTIF", AKTIF: "TUTUP", TUTUP: "AKTIF" };
    try {
      await apiFetch(`/api/kuesioner/${k.id}`, { method: "PATCH", body: JSON.stringify({ status: next[k.status] }) });
      fetchKuesioner();
    } catch (e: any) { alert(e.message); }
  };

  const hapusKuesioner = (k: Kuesioner) => {
    setConfirmData({
      open: true, title: "Hapus Kuesioner",
      message: `Hapus "${k.judul}" beserta semua data jawaban? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        await apiFetch(`/api/kuesioner/${k.id}`, { method: "DELETE" });
        setConfirmData({ open: false }); fetchKuesioner();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm uppercase tracking-widest">Manajemen Kuesioner</h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{list.length} kuesioner terdaftar</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm">
          <Plus size={12} /> Buat Kuesioner
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-300 dark:text-gray-600">
          <Activity size={20} className="animate-spin text-emerald-500" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <ClipboardList size={24} className="text-gray-200 dark:text-gray-700" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Belum ada kuesioner. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(k => {
            const totalPertanyaan = k.indikator.reduce((s, i) => s + i.pertanyaan.length, 0);
            return (
              <div key={k.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelected(k)}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", STATUS_STYLE[k.status])}>
                        {k.status}
                      </span>
                      <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase">{k.jenis}</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1">{k.judul}</h4>
                    {k.deskripsi && <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{k.deskripsi}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400 dark:text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><ListChecks size={9} /> {k.indikator.length} Indikator</span>
                      <span className="flex items-center gap-1"><FileQuestion size={9} /> {totalPertanyaan} Pertanyaan</span>
                      <span className="flex items-center gap-1"><Users size={9} /> {k._count?.jawaban || 0} Responden</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleStatus(k)}
                      className={cn("p-1.5 rounded-lg transition-all text-xs",
                        k.status === "AKTIF" ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")}
                      title={k.status === "AKTIF" ? "Tutup" : "Aktifkan"}>
                      {k.status === "AKTIF" ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => setSelected(k)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-emerald-500 transition-all" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => hapusKuesioner(k)} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition-all" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateKuesionerModal onClose={() => setShowCreate(false)} onCreated={(k) => { setShowCreate(false); setSelected(k); fetchKuesioner(); }} />}
      <ConfirmModal open={confirmData.open} onClose={() => setConfirmData({ open: false })}
        onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} confirmVariant="danger" />
    </div>
  );
}

// ===== CREATE KUESIONER MODAL =====
function CreateKuesionerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: Kuesioner) => void }) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [jenis, setJenis] = useState<JenisKuesioner>("UMUM");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const JENIS_OPTIONS: { value: JenisKuesioner; label: string; desc: string }[] = [
    { value: "UMUM", label: "Umum", desc: "Kuesioner bebas / asesmen umum" },
    { value: "DCM", label: "DCM", desc: "Daftar Cek Masalah siswa" },
    { value: "SOSIOMETRI", label: "Sosiometri", desc: "Pemetaan hubungan sosial" },
    { value: "INVENTORI", label: "Inventori", desc: "Inventori minat atau kepribadian" },
  ];

  const submit = async () => {
    if (!judul.trim()) { setErr("Judul wajib diisi"); return; }
    setSaving(true);
    try {
      const k = await apiFetch("/api/kuesioner", { method: "POST", body: JSON.stringify({ judul, deskripsi, jenis }) });
      onCreated(k);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm uppercase tracking-widest">Buat Kuesioner Baru</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold block mb-1">Jenis Kuesioner</label>
            <div className="grid grid-cols-2 gap-1.5">
              {JENIS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setJenis(o.value)}
                  className={cn("p-2.5 rounded-xl text-left border transition-all",
                    jenis === o.value ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-600" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wide", jenis === o.value ? "text-emerald-700 dark:text-emerald-300" : "text-gray-600 dark:text-gray-300")}>{o.label}</p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold block mb-1">Judul Kuesioner <span className="text-red-400">*</span></label>
            <input value={judul} onChange={e => setJudul(e.target.value)} placeholder="e.g., Asesmen Stres Akademik Semester 2"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold block mb-1">Deskripsi (Opsional)</label>
            <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} rows={2}
              placeholder="Petunjuk pengisian atau tujuan kuesioner..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 resize-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          {err && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {err}</p>}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Batal</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Activity size={12} className="animate-spin" /> : <Plus size={12} />} Buat & Edit
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ===== ADMIN KUESIONER DETAIL (Edit Indikator & Pertanyaan) =====
function AdminKuesionerDetail({ kuesioner, onBack, onRefresh }: { kuesioner: Kuesioner; onBack: () => void; onRefresh: () => void }) {
  const [k, setK] = useState<Kuesioner>(kuesioner);
  const [showHasil, setShowHasil] = useState(false);
  const [hasil, setHasil] = useState<any[]>([]);
  const [loadingHasil, setLoadingHasil] = useState(false);
  const [showAddIndikator, setShowAddIndikator] = useState(false);
  const [newIndNama, setNewIndNama] = useState("");
  const [newIndDesc, setNewIndDesc] = useState("");
  const [expandedInd, setExpandedInd] = useState<string | null>(null);
  const [showAddQ, setShowAddQ] = useState<string | null>(null); // indikatorId
  const [savingInd, setSavingInd] = useState(false);
  const [confirmData, setConfirmData] = useState<any>({ open: false });

  const refresh = async () => {
    try {
      const data = await apiFetch("/api/kuesioner");
      const listData: Kuesioner[] = Array.isArray(data) ? data : [];
      const updated = listData.find(x => x.id === k.id);
      if (updated) setK(updated);
    } catch (e) { console.error("AdminKuesionerDetail refresh error:", e); }
  };

  const toggleStatus = async () => {
    const next: Record<StatusKuesioner, StatusKuesioner> = { DRAFT: "AKTIF", AKTIF: "TUTUP", TUTUP: "AKTIF" };
    try {
      await apiFetch(`/api/kuesioner/${k.id}`, { method: "PATCH", body: JSON.stringify({ status: next[k.status] }) });
      refresh();
    } catch (e: any) {
      setConfirmData({ open: true, title: "Gagal", message: e.message, isAlert: true, onConfirm: () => setConfirmData({ open: false }) });
    }
  };

  const addIndikator = async () => {
    if (!newIndNama.trim()) return;
    setSavingInd(true);
    try {
      await apiFetch(`/api/kuesioner/${k.id}/indikator`, {
        method: "POST", body: JSON.stringify({ nama: newIndNama, deskripsi: newIndDesc, urutan: k.indikator.length })
      });
      setNewIndNama(""); setNewIndDesc(""); setShowAddIndikator(false);
      refresh();
    } catch (e: any) {
      setConfirmData({ open: true, title: "Gagal", message: e.message, isAlert: true, onConfirm: () => setConfirmData({ open: false }) });
    } finally { setSavingInd(false); }
  };

  const hapusIndikator = (ind: Indikator) => {
    setConfirmData({
      open: true, title: "Hapus Indikator",
      message: `Hapus indikator "${ind.nama}" beserta semua pertanyaannya?`,
      onConfirm: async () => {
        await apiFetch(`/api/indikator/${ind.id}`, { method: "DELETE" });
        setConfirmData({ open: false }); refresh();
      }
    });
  };

  const hapusPertanyaan = (p: Pertanyaan) => {
    setConfirmData({
      open: true, title: "Hapus Pertanyaan",
      message: `Hapus pertanyaan ini?`,
      onConfirm: async () => {
        await apiFetch(`/api/pertanyaan/${p.id}`, { method: "DELETE" });
        setConfirmData({ open: false }); refresh();
      }
    });
  };

  const loadHasil = async () => {
    setLoadingHasil(true);
    try { setHasil(await apiFetch(`/api/kuesioner/${k.id}/hasil`)); }
    catch (e) { console.error(e); }
    finally { setLoadingHasil(false); }
  };

  const STATUS_STYLE: Record<StatusKuesioner, string> = {
    DRAFT: "bg-gray-100 dark:bg-gray-800 text-gray-500",
    AKTIF: "bg-emerald-50 dark:bg-emerald-950 text-emerald-600",
    TUTUP: "bg-red-50 dark:bg-red-950 text-red-500",
  };
  const JENIS_ICON: Record<JenisPertanyaan, React.ReactNode> = {
    LIKERT: <Star size={10} />, SKALA: <SlidersHorizontal size={10} />,
    PILIHAN_GANDA: <CheckSquare size={10} />, YA_TIDAK: <ToggleRight size={10} />, ESAI: <AlignLeft size={10} />
  };
  const JENIS_LABEL: Record<JenisPertanyaan, string> = {
    LIKERT: "Likert 1-5", SKALA: "Skala 1-10", PILIHAN_GANDA: "Pilihan Ganda", YA_TIDAK: "Ya/Tidak", ESAI: "Esai"
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-emerald-600 transition-all shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", STATUS_STYLE[k.status])}>{k.status}</span>
            <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase">{k.jenis}</span>
          </div>
          <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{k.judul}</h3>
          {k.deskripsi && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{k.deskripsi}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={toggleStatus}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border",
              k.status === "AKTIF" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-500" : "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-600")}>
            {k.status === "AKTIF" ? <><ToggleLeft size={12} /> Tutup</> : <><ToggleRight size={12} /> Aktifkan</>}
          </button>
          <button onClick={() => { setShowHasil(!showHasil); if (!showHasil) loadHasil(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300 transition-all">
            <BarChart2 size={12} /> Hasil
          </button>
        </div>
      </div>

      {/* Hasil Section */}
      {showHasil && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-widest">Hasil Jawaban Siswa</h4>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">{hasil.length} responden</span>
          </div>
          {loadingHasil ? (
            <div className="py-8 flex items-center justify-center"><Activity size={18} className="animate-spin text-emerald-500" /></div>
          ) : hasil.length === 0 ? (
            <div className="py-8 text-center text-[10px] text-gray-300 dark:text-gray-600 uppercase tracking-widest">Belum ada yang mengisi</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Siswa</th>
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3">Waktu Submit</th>
                    <th className="px-4 py-3">Jawaban</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {hasil.map((h: any) => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">{h.user.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">{h.user.nis}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-[10px]">{new Date(h.submittedAt).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-[10px]">{h.detail.length} jawaban</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Indikator List */}
      <div className="space-y-3">
        {k.indikator.length === 0 && !showAddIndikator && (
          <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            <ListChecks size={20} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Tambah indikator pertama untuk mulai</p>
          </div>
        )}
        {k.indikator.map((ind, iIdx) => (
          <div key={ind.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Indikator header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setExpandedInd(expandedInd === ind.id ? null : ind.id)}>
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-bold shrink-0">{iIdx + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-gray-800 dark:text-gray-100">{ind.nama}</p>
                {ind.deskripsi && <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{ind.deskripsi}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-gray-400 dark:text-gray-500">{ind.pertanyaan.length} pertanyaan</span>
                <button onClick={e => { e.stopPropagation(); hapusIndikator(ind); }} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all">
                  <Trash2 size={12} />
                </button>
                {expandedInd === ind.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </div>

            {/* Pertanyaan list */}
            {expandedInd === ind.id && (
              <div>
                {ind.pertanyaan.length === 0 && (
                  <div className="px-4 py-5 text-center text-[10px] text-gray-300 dark:text-gray-600 uppercase tracking-widest">Belum ada pertanyaan</div>
                )}
                {ind.pertanyaan.map((p, pIdx) => (
                  <div key={p.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span className="text-[9px] text-gray-300 dark:text-gray-600 font-mono mt-0.5 w-5 shrink-0">{pIdx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{p.teks}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          {JENIS_ICON[p.jenis]} {JENIS_LABEL[p.jenis]}
                        </span>
                        {!p.wajib && <span className="text-[8px] text-gray-300 dark:text-gray-600 uppercase">Opsional</span>}
                        {p.opsi.length > 0 && <span className="text-[8px] text-gray-400 dark:text-gray-500">{p.opsi.length} opsi</span>}
                      </div>
                    </div>
                    <button onClick={() => hapusPertanyaan(p)} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {/* Add Pertanyaan form inline */}
                {showAddQ === ind.id ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
                    <AddPertanyaanForm
                      indikatorId={ind.id}
                      onSaved={() => { setShowAddQ(null); refresh(); }}
                      onCancel={() => setShowAddQ(null)}
                    />
                  </div>
                ) : (
                  <button onClick={() => setShowAddQ(ind.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 text-[9px] font-bold uppercase tracking-widest text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all border-t border-gray-50 dark:border-gray-800">
                    <Plus size={11} /> Tambah Pertanyaan
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Indikator */}
      {showAddIndikator ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm space-y-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Indikator Baru</p>
          <input value={newIndNama} onChange={e => setNewIndNama(e.target.value)} placeholder="Nama Indikator (e.g., Stres Akademik)"
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          <input value={newIndDesc} onChange={e => setNewIndDesc(e.target.value)} placeholder="Deskripsi (opsional)"
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          <div className="flex gap-2">
            <button onClick={() => setShowAddIndikator(false)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[9px] font-bold uppercase text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Batal</button>
            <button onClick={addIndikator} disabled={savingInd || !newIndNama.trim()}
              className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
              {savingInd ? <Activity size={11} className="animate-spin" /> : <Check size={11} />} Simpan
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddIndikator(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-500 transition-all flex items-center justify-center gap-1.5">
          <Plus size={13} /> Tambah Indikator
        </button>
      )}

      <ConfirmModal open={confirmData.open} onClose={() => setConfirmData({ open: false })}
        onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} confirmVariant="danger" />
    </div>
  );
}

// ===== ADD PERTANYAAN FORM =====
function AddPertanyaanForm({ indikatorId, onSaved, onCancel }: { indikatorId: string; onSaved: () => void; onCancel: () => void }) {
  const [teks, setTeks] = useState("");
  const [jenis, setJenis] = useState<JenisPertanyaan>("LIKERT");
  const [wajib, setWajib] = useState(true);
  const [opsi, setOpsi] = useState([{ teks: "", nilai: 1 }, { teks: "", nilai: 2 }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const needsOpsi = jenis === "PILIHAN_GANDA";

  const addOpsi = () => setOpsi([...opsi, { teks: "", nilai: opsi.length + 1 }]);
  const removeOpsi = (i: number) => setOpsi(opsi.filter((_, idx) => idx !== i));
  const updateOpsi = (i: number, teks: string) => setOpsi(opsi.map((o, idx) => idx === i ? { ...o, teks } : o));

  const JENIS_OPTIONS: { value: JenisPertanyaan; label: string; icon: React.ReactNode }[] = [
    { value: "LIKERT", label: "Likert 1-5", icon: <Star size={11} /> },
    { value: "SKALA", label: "Skala 1-10", icon: <SlidersHorizontal size={11} /> },
    { value: "PILIHAN_GANDA", label: "Pilihan Ganda", icon: <CheckSquare size={11} /> },
    { value: "YA_TIDAK", label: "Ya / Tidak", icon: <ToggleRight size={11} /> },
    { value: "ESAI", label: "Esai", icon: <AlignLeft size={11} /> },
  ];

  const submit = async () => {
    if (!teks.trim()) { setErr("Teks pertanyaan wajib diisi"); return; }
    if (needsOpsi && opsi.some(o => !o.teks.trim())) { setErr("Semua opsi harus diisi"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/indikator/${indikatorId}/pertanyaan`, {
        method: "POST",
        body: JSON.stringify({ teks, jenis, wajib, urutan: 0, opsi: needsOpsi ? opsi : [] })
      });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold block mb-1">Jenis Pertanyaan</label>
        <div className="flex flex-wrap gap-1.5">
          {JENIS_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setJenis(o.value)}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all",
                jenis === o.value ? "bg-emerald-500 text-white border-emerald-500" : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold block mb-1">Teks Pertanyaan <span className="text-red-400">*</span></label>
        <textarea value={teks} onChange={e => setTeks(e.target.value)} rows={2}
          placeholder="Tuliskan pertanyaan di sini..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-400 resize-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
      </div>
      {needsOpsi && (
        <div className="space-y-1.5">
          <label className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold block">Opsi Jawaban</label>
          {opsi.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] text-gray-400 dark:text-gray-500 w-4 font-mono">{String.fromCharCode(65 + i)}.</span>
              <input value={o.teks} onChange={e => updateOpsi(i, e.target.value)}
                placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
              {opsi.length > 2 && (
                <button onClick={() => removeOpsi(i)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all"><X size={12} /></button>
              )}
            </div>
          ))}
          <button onClick={addOpsi} className="flex items-center gap-1 text-[9px] text-emerald-500 hover:text-emerald-600 font-bold uppercase tracking-wide mt-1">
            <Plus size={10} /> Tambah Opsi
          </button>
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={wajib} onChange={e => setWajib(e.target.checked)} className="rounded accent-emerald-500" />
        <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold">Wajib Diisi</span>
      </label>
      {err && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={10} /> {err}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[9px] font-bold uppercase text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Batal</button>
        <button onClick={submit} disabled={saving}
          className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
          {saving ? <Activity size={11} className="animate-spin" /> : <Save size={11} />} Simpan
        </button>
      </div>
    </div>
  );
}
