import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body parsers
  app.use(express.json());

  // API route for Santri AI
  app.post("/api/gemini/santri-ai", async (req, res) => {
    try {
      const { prompt, history, latestKitabTitles } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({ 
          error: "Sistem asisten belum terkonfigurasi secara lengkap. Kunci `GEMINI_API_KEY` belum disetel di bagian Settings > Secrets di AI Studio." 
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

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to port 3000 and 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MUARA Server] Server is actively listening on http://localhost:${PORT}`);
  });
}

startServer();
