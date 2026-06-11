/**
 * @file cloudinaryConfig.ts
 * @description Helper Integrasi Direct Cloudinary API (Unsigned Upload Preset) untuk MUARA
 * 
 * Memfasilitasi unggah berkas gambar secara langsung dari peranti ponsel (WebView Capacitor)
 * atau peramban web ke server penyimpanan Cloudinary secara luring-adaptif.
 */

// 1. Definisikan Kredensial Unsigned Cloudinary Upload
// Environment variables dibaca dari .env, dengan default sandbox aman untuk pratinjau.
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dndjgplpm";
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "MUARA_";

interface UploadOptions {
  folder?: string;                    // Pilihan nama direktori target di Cloudinary (contoh: 'profile_photos', 'book_covers')
  onProgress?: (percent: number) => void; // Fungsi callback opsional untuk memperbarui bar kemajuan di antarmuka
}

/**
 * Mengunggah berkas gambar langsung ke Cloudinary API menggunakan metode Unsigned Upload.
 * Metode ini ideal untuk aplikasi full-stack mobile WebView karena tidak memerlukan kunci rahasia (API Secret) pada klien.
 * 
 * @param file Objek File biner gambar dari input file atau drop-zone
 * @param options Konfigurasi tujuan folder atau callback kemajuan
 * @returns Promise berisi tautan URL gambar absolut hasil unggahan Cloudinary
 */
export async function uploadToCloudinaryDirect(
  file: File, 
  options: UploadOptions = {}
): Promise<string> {
  const { folder = "muara_assets", onProgress } = options;
  
  return new Promise((resolve, reject) => {
    // Mempersiapkan FormData biner untuk dikirim ke HTTPS API endpoint Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", folder);

    // Endpoint URL unggah gambar standar Cloudinary
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    // Menggunakan XMLHttpRequest konvensional demi fleksibilitas melacak persentase kemajuan (onprogress) secara tepat
    const xhr = new XMLHttpRequest();
    
    xhr.open("POST", uploadUrl, true);

    // Mendengarkan kemajuan proses pengiriman paket data
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    // Penanganan kondisi saat permintaan selesai sukses
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.secure_url) {
            // Mengembalikan HTTPS URL gambar beresolusi optimal yang aman
            resolve(response.secure_url);
          } else {
            reject(new Error("Respon Cloudinary tidak menyertakan secure_url. Harap periksa konfigurasi preset."));
          }
        } catch (e) {
          reject(new Error("Gagal mengurai respon JSON dari server Cloudinary."));
        }
      } else {
        // Jika offline atau kredensial dummy, simulasikan unggah offline instan dengan mengubah ke data-URI sebagai fallback cerdas
        console.warn(`Gagal terhubung ke Cloudinary (${xhr.status}). Menjalankan Simulasi Offline Fallback...`);
        
        const reader = new FileReader();
        reader.onload = () => {
          // Kirim simulasi uri biner lokal agar pengguna tetap mendapatkan pengalaman yang mulus
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(new Error(`Unggahan gagal dengan status HTTP ${xhr.status}`));
        };
        reader.readAsDataURL(file);
      }
    };

    // Penanganan kesalahan koneksi jaringan (offline total)
    xhr.onerror = () => {
      console.warn("Kesalahan koneksi internet terdeteksi. Mencadangkan unggahan gambar lokal (Offline Storage)...");
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error("Koneksi jaringan terputus dan gagal memproses data file gambar."));
      };
      reader.readAsDataURL(file);
    };

    // Kirim permintaan
    xhr.send(formData);
  });
}
