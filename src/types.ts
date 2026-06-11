/**
 * Types for MUARA (Kumpulan Kitab Kuning)
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatarUrl: string;
  isLoggedIn: boolean;
  membershipStatus: 'Gratis' | 'Premium Verified';
  expiresAt?: string;
  role?: 'user' | 'admin';
}

export interface ShalatSchedule {
  subuh: string;
  zuhur: string;
  asar: string;
  magrib: string;
  isya: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  dateSent: string;
  important: boolean;
  imageUrl?: string;
  target?: string;
  targetUserId?: string;
  targetUserEmail?: string;
}

export interface SedekahCampaign {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  collectedAmount: number;
  donorCount: number;
  thumbnailUrl: string;
  paymentType?: 'Bank Transfer' | 'QRIS Code';
  bankName?: string;
  bankAccountNo?: string;
  bankAccountHolder?: string;
  qrisImageUrl?: string;
  accounts?: {
    id: string;
    type: 'Bank Transfer' | 'QRIS Code';
    name: string;
    accountNo: string;
    accountHolder: string;
    qrisImageUrl?: string;
  }[];
}

export interface KitabKuning {
  id: string;
  title: string;
  arabicTitle: string;
  category: string;
  author: string;
  description: string;
  difficulty: 'Pemula' | 'Menengah' | 'Tingkat Lanjut';
  chaptersCount: number;
  chapters: KitabChapter[];
}

export interface KitabChapter {
  id: string;
  title: string;
  arabicTitle?: string;
  sections: KitabSection[];
}

export interface KitabSection {
  id: string;
  subTitle: string;
  arabicText: string;
  translatedText: string;
  explanation: string;
}

export interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Makkiyah' | 'Madaniyah';
  verses: QuranVerse[];
}

export interface QuranVerse {
  number: number;
  text: string;
  translation: string;
  tafsir: string;
}

export interface KamusTerm {
  word: string;
  arabic: string;
  category: string;
  definition: string;
  example: string;
  exampleTranslation: string;
}

export interface HadisItem {
  id: string;
  title: string;
  arabicText: string;
  translatedText: string;
  narrator: string;
  explanation: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  duration: string;
  price: number;
  priceString: string;
  benefits: string[];
  popular?: boolean;
  slashPrice?: number;
}
