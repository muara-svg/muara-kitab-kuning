import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import zlib from "zlib";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

// Middleware to normalize URL path for Vercel Serverless environment
app.use((req, res, next) => {
  if (req.originalUrl) {
    req.url = req.originalUrl;
  }
  next();
});

// Configure CORS middleware to enable Capacitor access
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =========================================================================
// 🛡️ SUNTIKAN AMAN: MEMBACA KONFIGURASI FIREBASE SECARA DINAMIS (ANTI-CRASH)
// =========================================================================
let firebaseConfigData: any = {};
try {
  // Membaca json secara runtime menggunakan fs (Aman dari aturan ketat ERR_IMPORT_ATTRIBUTE_MISSING)
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfigData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.log("[Backend Firebase] Backup JSON config file not found or unreadable, using env variables.");
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
  appId: process.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const customDbId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const activeDbId = customDbId !== undefined 
  ? (customDbId === "(default)" ? undefined : customDbId) 
  : (process.env.VITE_FIREBASE_PROJECT_ID ? undefined : firebaseConfigData.firestoreDatabaseId);

const firestoreDb = getFirestore(firebaseApp, activeDbId);
// =========================================================================

// Cloudinary configuration constants
const CLOUDINARY_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME || "dndjgplpm";
const CLOUDINARY_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET || "MUARA_";

// Compression & Decompression helpers using standard zlib
const compressData = (text: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    zlib.gzip(Buffer.from(text, 'utf-8'), (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
};

const decompressData = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (err, decompressed) => {
      if (err) reject(err);
      else resolve(decompressed.toString('utf-8'));
    });
  });
};

// POST / PUT endpoint to save Kitab content
app.post("/api/kitab-contents", async (req, res) => {
  try {
    const { id, textBody, pages, ...rest } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "Kitab ID as parameter is required." });
    }

    const docRef = doc(firestoreDb, "kitab_contents", id);
    const textToCompress = textBody || "";
    const pagesArray = pages || [];
    const pagesSerialized = JSON.stringify(pagesArray);
    const sizeInBytes = Buffer.byteLength(textToCompress, 'utf8') + Buffer.byteLength(pagesSerialized, 'utf8');

    if (sizeInBytes > 300000) {
      console.log(`[Backend Storage] Kitab ${id} exceeds size limit (${sizeInBytes} bytes). Compressing and uploading package to Cloudinary...`);
      
      const payloadString = JSON.stringify({
        textBody: textToCompress,
        pages: pages || []
      });
      
      const compressedBuffer = await compressData(payloadString);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;
      const blob = new Blob([compressedBuffer], { type: 'application/gzip' });
      const formData = new FormData();
      formData.append('file', blob, `${id}_contents.txt.gz`);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'muara_kitab_gzips');

      const clResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!clResponse.ok) {
        const clErrText = await clResponse.text();
        throw new Error(`Cloudinary raw file upload failed with status ${clResponse.status}: ${clErrText}`);
      }

      const clJson = await clResponse.json();
      const secureUrl = clJson.secure_url;

      if (!secureUrl) {
        throw new Error("Cloudinary upload did not return a valid secure URL.");
      }

      const contentPayload = {
        id,
        isSegmented: false,
        chunkCount: 0,
        cloudinaryUrl: secureUrl,
        textBody: "", 
        pages: [],     
        updatedAt: new Date().toISOString(),
        ...rest
      };

      await setDoc(docRef, contentPayload, { merge: true });
      return res.json({ success: true, cloudinaryUrl: secureUrl });

    } else {
      console.log(`[Backend Storage] Kitab ${id} is under threshold size (${sizeInBytes} bytes). Storing directly in Firestore.`);
      
      const contentPayload = {
        id,
        isSegmented: false,
        chunkCount: 0,
        textBody: textToCompress,
        pages: pages || [],
        updatedAt: new Date().toISOString(),
        ...rest
      };

      await setDoc(docRef, contentPayload, { merge: true });
      return res.json({ success: true });
    }

  } catch (err: any) {
    console.error("[Backend Storage POST Error]:", err);
    res.status(500).json({ error: err.message || "Failed to save kitab content via backend" });
  }
});

// GET endpoint to fetch Kitab content
app.get("/api/kitab-contents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Kitab ID is required" });
    }

    const docRef = doc(firestoreDb, "kitab_contents", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: "Kitab content document does not exist." });
    }

    const data = docSnap.data();
    if (data.cloudinaryUrl) {
      const clResponse = await fetch(data.cloudinaryUrl);
      if (!clResponse.ok) {
        throw new Error(`Failed to download book zip package: HTTP ${clResponse.status}`);
      }

      const compressedBuffer = Buffer.from(await clResponse.arrayBuffer());
      const decompressedText = await decompressData(compressedBuffer);

      let textBody = "";
      let pages: string[] = [];

      try {
        const parsed = JSON.parse(decompressedText);
        if (parsed && typeof parsed === 'object') {
          textBody = parsed.textBody || "";
          pages = parsed.pages || [];
        } else {
          textBody = decompressedText;
        }
      } catch (jsonErr) {
        textBody = decompressedText;
      }

      const finalResponse = {
        ...data,
        textBody,
        pages: pages.length > 0 ? pages : (data.pages || [])
      };

      return res.json(finalResponse);
    }

    res.json(data);

  } catch (err: any) {
    console.error("[Backend Storage GET Error]:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve and process book content" });
  }
});

// DELETE endpoint to clear Kitab content
app.delete("/api/kitab-contents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Kitab ID is required" });
    }

    const docRef = doc(firestoreDb, "kitab_contents", id);
    await deleteDoc(docRef);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Backend Storage DELETE Error]:", err);
    res.status(500).json({ error: err.message || "Failed to delete kitab content from Server" });
  }
});

// API route for Santri AI
app.post("/api/gemini/santri-ai", async (req, res) => {
  try {
    const { prompt, history, latestKitabTitles } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ 
        error: "Sistem asisten belum terkonfigurasi secara lengkap. Kunci `GEMINI_API_KEY` belum disetel di bagian Environment Variables di Vercel." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    let systemInstruction = `Kamu adalah 'Santri AI', asisten digital rujukan Kitab Kuning ahli fiqih, tasawuf, akidah, hadis, dll dari aplikasi MUARA. Tugasmu adalah mendampingi penelitian keagamaan pengguna, menjawab pertanyaan secara santun, ilmiah, berakhlak mulia, dan berbasis kitab kuning.

--- TATA TERTIB & STRUKTUR BALASAN ---
1. MENULIS BERBAGAI SISI PANDANGAN KITAB SECARA AKURAT:
   Jika suatu pembahasan terdapat di BEBERAPA KITAB yang berbeda di dalam database internal (konteks yang diberikan), kamu WAJIB menuliskan seluruh jawaban/pandangan dari masing-masing kitab secara berurutan. Kamu dilarang keras mencampuradukkan penjelasan dari Kitab A dengan referensi/halaman dari Kitab B. Pastikan penjelasan ilmiahmu 100% selaras dan setia pada teks rujukan yang diberikan.

2. KEABSOLUTAN KECOCOKAN REFERENSI (SANGAT PENTING):
   Setiap penjelasan, hukum fiqih, atau kutipan ilmiah yang kamu paparkan wajib memiliki kecocokan yang sempurna dengan kutipan teks, nama kitab, dan nomor halaman dari rujukan yang bersangkutan di acuan utama.
   Dilarang keras menyandingkan penjelasan materi (misalnya, penjelasan tentang iman) dengan nomor halaman dari bagian rujukan yang membahas materi lain (misalnya, bersuci). Setiap penjelasan harus tepat bersumber dari isi kutipan yang dicantumkan referensinya di akhir penjelasan tersebut.

3. FORMAT & LETAK REFERENSI MUTLAK (TIDAK BOLEH MEMOTONG KALIMAT):
   Setiap kali selesai memaparkan penjelasan dari suatu kitab, kamu WAJIB menyertakan rujukan dengan format teks khusus: [Buka: Nama Kitab - Bab ... - Halaman ...].
   ATURAN PELETAKAN SANGAT KETAT:
   - Teks referensi [Buka: ...] ini HANYA boleh diletakkan di AKHIR KALIMAT atau AKHIR PARAGRAF setelah tanda titik terakhir dari pemaparan kitab tersebut.
   - DILARANG KERAS meletakkan link referensi [Buka: ...] di tengah-tengah kalimat, sebelum koma, sebelum titik, atau di tempat mana pun yang dapat memotong kelancaran kalimat.
   - Contoh salah: "Menurut kitab Safinatun Najah [Buka: Safinatun Najah - Bab Shalat - Halaman 3] shalat fardhu itu ada lima." (SALAH karena merusak aliran kalimat).
   - Contoh benar: "Shalat fardhu yang wajib dikerjakan dalam sehari semalam berjumlah lima waktu. [Buka: Safinatun Najah - Bab Shalat - Halaman 3]" (BENAR karena diletakkan di akhir kalimat setelah tanda titik).

4. KEJUJURAN CONTEXT:
   Jika jawaban sama sekali tidak ada di database internal (konteks rujukan) yang disediakan sistem sebagai acuan, beri tahu pengguna dengan jujur: 'Maaf Kak, materi atau pembahasan mengenai hal tersebut belum tersedia di dalam koleksi kitab aplikasi MUARA saat ini.' Jangan pernah mengarang jawaban keagamaan tanpa dasar konteks acuan yang diberikan.

--- PANDUAN PENGEMBANGAN FITUR & TAMPILAN MUARA (APP NAVIGATOR AI) ---
Kamu memiliki pengetahuan mendalam tentang semua tata letak menu dan fitur aplikasi MUARA. Jika pengguna bingung, tersesat, atau bertanya tentang fungsi aplikasi, berikan panduan navigasi yang jelas, ramah, dan solutif:
- Beranda: Terdiri dari Jadwal Shalat (berdasarkan koordinat GPS), Kalender Hijriah, Kolom Pencarian Kitab instant, dan Grid Kategori Kitab.
- Menu Akun / Profil: Berisi informasi profil user (Username, Email, No. HP, Gender, Bio pribadi, Tanggapan), Status Member (Gratis / Premium Verified), serta Riwayat Baca kitab terakhir pengguna.
- Menu Membership / Kemitraan: Halaman khusus untuk memilih paket berlangganan premium (Premium Member) demi membuka fitur audio, Santri AI tanpa batas, dan download kitab offline.
- Menu Notifikasi: Berisi pengumuman/pemberitahuan dari admin (notifikasi yang otomatis terhapus otomatis setelah 168 jam secara permanen untuk memelihara performa piringan aplikasi).
- Tentang Aplikasi: Penjelasan ekosistem digitalisasi kitab klasik salafiyah di bawah muara naungan Dewan Syuro.

--- PROTEKSI RAHASIA DAPUR APLIKASI (DATA & TECH GUARDRAIL) ---
Kamu dilarang keras membagikan detail teknis sensitif, struktur database internal, model relasi database, skema data, kredensial password, token JWT, file konfigurasi, API Key, source code, atau teknologi penyimpanan internal. Jika ditanya rahasia teknis, tolak halus dengan bernuansa Islami.

--- SENSOR KATA KOTOR & AKHLAK MODERATION ---
Deteksi kata kotor secara ketat dan berikan nasihat islami yang sejuk jika pengguna tidak sopan.

--- FLEXIBILITAS BAHASA SANTRI ---
Gunakan sapaan hangat seperti "Kakak", "Akhi", atau "Ukhti" dengan tutur kata yang santun dan penuh rasa hormat.

--- ATURAN SALAM (GREETING WORDS) ---
Kata salam HANYA boleh diucapkan di sesi pembuka awal percakapan saja. Sesi berikutnya DILARANG KERAS mengulang salam.`;

    if (latestKitabTitles && Array.isArray(latestKitabTitles) && latestKitabTitles.length > 0) {
      systemInstruction += `\n\n--- KITAB SAAT INI YANG TERSEDIA DI APLIKASI MUARA (Update Dinamis) ---\nDaftar kitab kuning: ${latestKitabTitles.join(', ')}.`;
    }

    const contentsParts: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contentsParts.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.parts[0].text }]
        });
      });
    }
    
    contentsParts.push({ role: "user", parts: [{ text: prompt }] });

    let result;
    try {
      result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsParts,
        config: { systemInstruction: systemInstruction, temperature: 0.3 }
      });
    } catch (primaryErr: any) {
      const errStr = String(primaryErr);
      if (errStr.includes("503") || errStr.includes("UNAVAILABLE")) {
        result = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: contentsParts,
          config: { systemInstruction: systemInstruction, temperature: 0.3 }
        });
      } else {
        throw primaryErr;
      }
    }

    const replyText = result.text || "Terjadi kesalahan dalam memberikan respon.";
    res.json({ text: replyText });
  } catch (err: any) {
    console.error("[Santri AI Server Error]:", err);
    res.status(500).json({ error: err.message || "Gagal berkomunikasi dengan Santri AI" });
  }
});

export default app;