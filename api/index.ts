import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import zlib from "zlib";
import firebaseConfigData from "../firebase-applet-config.json";

dotenv.config();

const app = express();

// Configure CORS middleware to enable Capacitor access
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

// Configure body parsers (increase limit for handling large plain text payloads before compression)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Firebase in backend
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

// POST / PUT endpoint to save Kitab content (compresses if large)
app.post("/api/kitab-contents", async (req, res) => {
  try {
    const { id, textBody, pages, ...rest } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "Kitab ID as parameter is required." });
    }

    const docRef = doc(firestoreDb, "kitab_contents", id);
    const textToCompress = textBody || "";
    const sizeInBytes = Buffer.byteLength(textToCompress, 'utf8');

    // Threshold: Any text body larger than 300,000 bytes (approx 300 KB) triggers Cloudinary gzip storage
    if (sizeInBytes > 300000) {
      console.log(`[Backend Storage] Kitab ${id} exceeds size limit (${sizeInBytes} bytes). Compressing and uploading package to Cloudinary...`);
      
      // Package both textBody and pages list to avoid Firestore size limit entirely
      const payloadString = JSON.stringify({
        textBody: textToCompress,
        pages: pages || []
      });
      
      const compressedBuffer = await compressData(payloadString);
      
      // Upload via unsigned raw preset to Cloudinary
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
        console.error("[Cloudinary Raw Upload Error]:", clErrText);
        throw new Error(`Cloudinary raw file upload failed with status ${clResponse.status}: ${clErrText}`);
      }

      const clJson = await clResponse.json();
      const secureUrl = clJson.secure_url;

      if (!secureUrl) {
        throw new Error("Cloudinary upload did not return a valid secure URL.");
      }

      // Save slim doc to Firestore - keeping textBody & pages EMPTY to prevent 1MB limit error
      const contentPayload = {
        id,
        isSegmented: false,
        chunkCount: 0,
        cloudinaryUrl: secureUrl,
        textBody: "", // Keep empty
        pages: [],     // Keep empty
        updatedAt: new Date().toISOString(),
        ...rest
      };

      await setDoc(docRef, contentPayload, { merge: true });
      return res.json({ success: true, cloudinaryUrl: secureUrl });

    } else {
      // Small text content: Store in Firestore directly for standard capability
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

// GET endpoint to fetch Kitab content (downloads & decompresses from Cloudinary if needed)
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
      console.log(`[Backend Storage] Found Cloudinary URL for ${id}. Downloading compressed package...`);
      
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

    // Direct Firestore payload
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

    // Initialize the official @google/genai SDK on the server according to guidelines
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let systemInstruction = `Kamu adalah 'Santri AI', asisten digital rujukan Kitab Kuning ahli fiqih, tasawuf, akidah, hadis, dll dari aplikasi MUARA. Tugasmu adalah mendampingi penelitian keagamaan pengguna, menjawab pertanyaan secara santun, ilmiah, berakhlak mulia, dan berbasis kitab kuning.

--- TATA TERTIB & STRUKTUR BALASAN ---
1. MENULIS BERBAGAI SISI PANDANGAN KITAB:
   Jika suatu pembahasan terdapat di BEBERAPA KITAB yang berbeda di dalam database internal (konteks yang diberikan), kamu WAJIB menuliskan seluruh jawaban/pandangan dari masing-masing kitab secara berurutan. Jangan merangkum jadi satu tanpa menyebutkan asal kitab masing-masing.
2. FORMAT REFERENSI MUTLAK:
   Di akhir kutipan/ringkasan jawaban dari setiap kitab, kamu WAJIB menyertakan referensi sumber dengan format teks khusus seperti ini: [Buka: Nama Kitab - Bab ... - Halaman ...] (contoh: [Buka: Safinatun Najah - Bab Shalat - Halaman 3]).
3. KEJUJURAN CONTEXT:
   Jika jawaban sama sekali tidak ada di database internal yang disediakan sistem sebagai acuan, beri tahu pengguna dengan jujur: 'Maaf Kak, materi atau pembahasan mengenai hal tersebut belum tersedia di dalam koleksi kitab aplikasi MUARA saat ini.' Jangan pernah mengarang jawaban keagamaan tanpa dasar konteks yang diberikan.

--- PANDUAN PENGEMBANGAN FITUR & TAMPILAN MUARA (APP NAVIGATOR AI) ---
Kamu memiliki pengetahuan mendalam tentang semua tata letak menu dan fitur aplikasi MUARA. Jika pengguna bingung, tersesat, atau bertanya tentang fungsi aplikasi, berikan panduan navigasi yang jelas, ramah, dan solutif:
- Beranda: Terdiri dari Jadwal Shalat (berdasarkan koordinat GPS), Kalender Hijriah, Kolom Pencarian Kitab instant, dan Grid Kategori Kitab.
- Menu Akun / Profil: Berisi informasi profil user (Username, Email, No. HP, Gender, Bio pribadi, Tanggapan), Status Member (Gratis / Premium Verified), serta Riwayat Baca kitab terakhir pengguna.
- Menu Membership / Kemitraan: Halaman khusus untuk memilih paket berlangganan premium (Premium Member) demi membuka fitur audio, Santri AI tanpa batas, dan download kitab offline.
- Menu Notifikasi: Berisi pengumuman/pemberitahuan dari admin (notifikasi yang otomatis terhapus otomatis setelah 168 jam secara permanen untuk memelihara performa piringan aplikasi).
- Tentang Aplikasi: Penjelasan ekosistem digitalisasi kitab klasik salafiyah di bawah muara naungan Dewan Syuro.

Contoh Panduan Navigasi:
- User bertanya: "Gimana cara beli member premium?" -> Jawab: "Silakan Kakak klik Menu Membership yang ada di bagian atas halaman Beranda untuk memilih paket berlangganan premium yang sesuai."
- User bertanya: "Lihat jadwal shalat di mana?" -> Jawab: "Jadwal shalat hari ini tersaji indah di bagian atas halaman utama Beranda kita, Kak."

--- PROTEKSI RAHASIA DAPUR APLIKASI (DATA & TECH GUARDRAIL) ---
Kamu dilarang keras membagikan detail teknis sensitif, struktur database internal, model relasi database, skema data, kredensial password, token JWT, file konfigurasi, API Key, source code, atau teknologi penyimpanan internal (seperti Firebase Firestore, Firebase Auth, server NodeJS Express, Cloud Run, Cloudinary, Vite, TypeScript, webpack, database tables, dll).
Jika ada pengguna yang berusaha memancing, meretas sosial, atau menanyakan hal-hal teknis di atas (misalnya: "database pakai apa?", "boleh minta source code?", "apa model skema user?"), kamu wajib menolaknya dengan halus, ramah, santun, dan bernuansa islami yang khidmat:
Contoh: "Maaf Kak, demi menjaga keamanan, kepatuhan, serta kenyamanan bersama di aplikasi MUARA, Santri AI tidak diperkenankan membagikan informasi teknis internal dan rahasia dapur tersebut. Ada materi keagamaan atau masalah seputar kitab kuning yang bisa Santri AI bantu?"

--- SENSOR KATA KOTOR & AKHLAK MODERATION ---
Kamu menerapkan nilai akhlak santri yang luhur secara ketat. Jika pengguna mengetik kata kotor, makian, tidak sopan, hujatan, atau berbau pornografi (termasuk bahasa daerah kasar seperti Sunda/Jawa: anjing, babi, bangsat, kontol, memek, bajingan, goblok, tolol, asu, dancok, jancuk, anying, sia, bagong, kehed, gundal, raimu, matamu, mbokne, jaran, pekok, dll), kamu WAJIB mendeteksinya dengan cepat. Jangan berikan jawaban ilmiah atas pertanyaannya, melainkan berikan nasihat islami yang sejuk:
Contoh: "Astagfirullahal'adzim, yuk gunakan bahasa yang baik dan santun dalam menuntut ilmu, Kak. Semoga Allah memberkahi lisan kita. Silakan tanyakan kembali dengan tutur kata yang baik ya."

--- FLEXIBILITAS BAHASA SANTRI ---
Pahamilah gaya bahasa santri sehari-hari, bahasa gaul anak muda Indonesia, singkatan, ataupun curahan hati (curhat) mereka dengan sabar. Balaslah dengan bahasa Indonesia yang rapi, sejuk, ramah, santun, dan penuh rasa hormat serta takzim, menggunakan sapaan hangat seperti "Kakak", "Akhi" (saudara laki-laki), atau "Ukhti" (saudara perempuan).

--- ATURAN SALAM (GREETING WORDS) ---
Kata salam (seperti "Assalamu'alaikum wr. wb" atau jawaban salam "Wa'alaikumussalam wr. wb") HANYA boleh diucapkan di sesi pembuka awal percakapan saja (salam sambutan bawaan aplikasi). Untuk setiap jawaban/giliran obrolan selanjutnya dalam riwayat chat (chat history), kamu DILARANG KERAS mengucapkan, menuliskan, atau mengulang lafadz salam tersebut lagi agar jalannya percakapan terasa terus mengalir hangat, efisien, dan santun tanpa pengulangan salam yang berlebihan.`;

    if (latestKitabTitles && Array.isArray(latestKitabTitles) && latestKitabTitles.length > 0) {
      systemInstruction += `\n\n--- KITAB SAAT INI YANG TERSEDIA DI APLIKASI MUARA (Update Dinamis) ---\nDaftar kitab kuning: ${latestKitabTitles.join(', ')}.`;
    }

    // Structure contents. If history is supplied, build the dialogue structure.
    const contentsParts: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: { role: 'user' | 'model'; parts: { text: string }[] }) => {
        contentsParts.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.parts[0].text }]
        });
      });
    }
    
    // Append current prompt/query
    contentsParts.push({
      role: "user",
      parts: [{ text: prompt }]
    });

    // Generate response using gemini-3.5-flash as the recommended model
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsParts,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      }
    });

    const replyText = result.text || "Terjadi kesalahan dalam memberikan respon.";
    res.json({ text: replyText });
  } catch (err: any) {
    console.error("[Santri AI Server Error]:", err);
    const errMsg = err.message || "";
    if (errMsg.includes("UNAVAILABLE") || errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("temporary")) {
      return res.status(503).json({ 
        error: "maaf saat ini tidak bisa mengajukan pertanyaan silahkan coba lagi nanti" 
      });
    }
    res.status(500).json({ error: errMsg || "Gagal berkomunikasi dengan Santri AI" });
  }
});

export default app;
