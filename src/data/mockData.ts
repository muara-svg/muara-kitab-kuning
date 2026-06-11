import { 
  KitabKuning, 
  QuranSurah, 
  KamusTerm, 
  HadisItem, 
  NotificationItem, 
  SedekahCampaign,
  MembershipPlan
} from '../types';

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_SEDEKAH_CAMPAIGNS: SedekahCampaign[] = [
  {
    id: 's-1',
    title: 'Sedekah Digitalisasi Kitab Kuning Klasik',
    description: 'Bantu kami mendigitalisasi ratusan naskah kuno manuskrip Kitab Kuning dari para ulama Nusantara terpilih ke dalam format salinan digital interaktif agar bisa dipelajari generasi mendatang.',
    targetAmount: 50000000,
    collectedAmount: 24750000,
    donorCount: 312,
    thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 's-2',
    title: 'Patungan Pesantren Pelosok & Kitab Santri',
    description: 'Salurkan bantuan kitab kuning fisik, mushaf Al-Quran, serta beasiswa pangan santri yatim dhuafa di pesantren-pesantren pelosok Jawa Barat, NTT, dan Sulawesi.',
    targetAmount: 35000000,
    collectedAmount: 18450000,
    donorCount: 198,
    thumbnailUrl: 'https://images.unsplash.com/photo-1574259382103-6142c3d67443?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 's-3',
    title: 'Operasional Server & Pengembangan Fitur MUARA',
    description: 'Dukung keberlanjutan beasiswa dakwah digital agar aplikasi MUARA tetap aktif bebas iklan, kencang, dan terus meningkatkan fasilitas pencarian kitab berbasis kecerdasan buatan.',
    targetAmount: 20000000,
    collectedAmount: 12900000,
    donorCount: 145,
    thumbnailUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=400'
  }
];

export const MEMBERSHIP_PLANS: MembershipPlan[] = [];

export const MOCK_KITABS: KitabKuning[] = [
  {
    id: 'kitab-1',
    title: 'Al-Hikam',
    arabicTitle: 'الحكم العطائية',
    category: 'Tasawuf & Akhlak',
    author: 'Syekh Ibnu Atha\'illah As-Sakandari',
    description: 'Kitab tasawuf legendaris yang berisi petuah-petuah bijak seputar makrifatullah, tauhid, pembersihan jiwa, dan adab hamba kepada Sang Pencipta.',
    difficulty: 'Tingkat Lanjut',
    chaptersCount: 3,
    chapters: [
      {
        id: 'k1-ch1',
        title: 'Bab 1: Bersandar pada Amal',
        arabicTitle: 'اَلْإِعْتِمَادُ عَلَى الْعَمَلِ',
        sections: [
          {
            id: 'k1-c1-s1',
            subTitle: 'Pasal 1: Tanda Bersandar pada Amal',
            arabicText: 'مِنْ عَلَامَاتِ الْاِعْتِمَادِ عَلَى الْعَمَلِ، نُقْصَانُ الرَّجَاءِ عِنْدَ وُجُودِ الزَّلَلِ.',
            translatedText: 'Di antara tanda-tanda bersandar pada amal (kekuatan diri sendiri) adalah berkurangnya rasa harap kepada Allah ketika terjadi kesalahan atau dosa.',
            explanation: 'Seseorang yang murni berharap kepada rahmat Allah tidak akan putus asa dari pengampunan-Nya ketika melakukan maksiat secara tidak sengaja, dan tidak pula menjadi sombong serta merasa suci ketika amalnya melimpah.'
          },
          {
            id: 'k1-c1-s2',
            subTitle: 'Pasal 2: Tajrid vs Kasab',
            arabicText: 'إِرَادَتُكَ التَّجْرِيدَ مَعَ إِقَامَةِ اللهِ إِيَّاكَ فِي الْأَسْبَابِ مِنَ الشَّهْوَةِ الْخَفِيَّةِ.',
            translatedText: 'Keinginanmu untuk tajrid (fokus ibadah murni tanpa bekerja) sementara Allah menempatkanmu pada maqam kasab (bekerja mencari nafkah) termasuk syahwat yang tersembunyi.',
            explanation: 'Seorang murid harus menerima ketetapan Allah. Jika takdirnya adalah bekerja mencari nafkah, jangan memaksa meninggalkan pekerjaan demi mengejar maqam sufi murni, begitupun sebaliknya, jalani dengan penuh ikhlas.'
          }
        ]
      },
      {
        id: 'k1-ch2',
        title: 'Bab 2: Pandangan Syahwat & Keinginan',
        arabicTitle: 'النَّظَرُ فِي الشَّهَوَاتِ',
        sections: [
          {
            id: 'k1-c2-s1',
            subTitle: 'Pasal 3: Kedudukan Doa hamba',
            arabicText: 'لَا يَكُنْ تَأَخُّرُ أَمَدِ الْعَطَاءِ مَعَ الْإِلْحَاحِ فِي الدُّعَاءِ مُوجِبًا لِيَأْسِكَ.',
            translatedText: 'Jangan sampai keterlambatan masa pemberian Allah kepadamu, padahal kamu bersungguh-sungguh dalam berdoa, menyebabkan keputusasaanmu.',
            explanation: 'Allah menjamin mengabulkan doamu sesuai dengan apa yang Dia pilihkan untukmu, bukan menurut apa yang kamu inginkan untuk dirimu sendiri, dan pada waktu yang Dia kehendaki, bukan pada waktu yang kamu jadwalkan sendiri.'
          }
        ]
      }
    ]
  },
  {
    id: 'kitab-2',
    title: 'Safinatun Najah',
    arabicTitle: 'سفينة النجاة',
    category: 'Fiqih Syafii',
    author: 'Syekh Salim bin Samir Al-Hadhrami',
    description: 'Kitab dasar fiqih ibadah madzhab Syafi\'i yang sangat populer di kalangan santri pemula pesantren Nusantara, mencakup rukun iman, rukun Islam, thaharah, dan shalat.',
    difficulty: 'Pemula',
    chaptersCount: 2,
    chapters: [
      {
        id: 'k2-ch1',
        title: 'Bab 1: Rukun Islam & Rukun Iman',
        arabicTitle: 'أَرْكَانُ الْإِسْلَامِ وَالْإِيمَانِ',
        sections: [
          {
            id: 'k2-c1-s1',
            subTitle: 'Pasal 1: Rukun Islam',
            arabicText: 'أَرْكَانُ الْإِسْلَامِ خَمْسَةٌ: شَهَادَةُ أَنْ لَا إِلٰهَ إِلَّا اللهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللهِ، وَإِقَامُ الصَّلَاةِ، وَإِيتَاءُ الزَّكَاةِ، وَصَوْمُ رَمَضَانَ، وَحِجُّ الْبَيْتِ مَنِ اسْتَطَاعَ إِلَيْهِ سَبِيلًا.',
            translatedText: 'Rukun Islam itu ada lima perkara: (1) Bersaksi bahwa tiada tuhan selain Allah dan Muhammad utusan Allah, (2) Mendirikan shalat, (3) Menunaikan zakat, (4) Berpuasa Ramadhan, (5) Berhaji bagi yang mampu menempuh jalannya.',
            explanation: 'Rukun ini merupakan pilar utama fondasi keislaman lahiriah hamba Allah secara universal.'
          },
          {
            id: 'k2-c1-s2',
            subTitle: 'Pasal 2: Rukun Iman',
            arabicText: 'أَرْكَانُ الْإِيمَانِ سِتَّةٌ: أَنْ تُؤْمِنَ بِاللهِ، وَمَلَائِكَتِهِ، وَكُتُبِهِ، وَرُسُلِهِ، وَبِالْيَوْمِ الْآخِرِ، وَبِالْقَدَرِ خَيْرِهِ وَشَرِّهِ مِنَ اللهِ تَعَالَى.',
            translatedText: 'Rukun Iman itu ada enam perkara: (1) Beriman kepada Allah, (2) Beriman kepada Malaikat-malaikat-Nya, (3) Beriman kepada kitab-kitab-Nya, (4) Beriman kepada Rasul-rasul-Nya, (5) Beriman kepada Hari Akhir, (6) Beriman kepada Qadha dan Qadar baik buruknya dari Allah Ta\'ala.',
            explanation: 'Iman merupakan ranah keyakinan dalam hati (batiniah) yang menjadi syarat mutlak diterimanya amal shalih.'
          }
        ]
      },
      {
        id: 'k2-ch2',
        title: 'Bab 2: Thaharah (Bersuci)',
        arabicTitle: 'كِتَابُ الطَّهَارَةِ',
        sections: [
          {
            id: 'k2-c2-s1',
            subTitle: 'Pasal 3: Tanda Baligh',
            arabicText: 'عَلَامَاتُ الْبُلُوغِ ثَلَاثٌ: تَمَامُ خَمْسَ عَشْرَةَ سَنَةً فِي الذَّكَرِ وَالْأُنْثَى، وَالِاحْتِلَامُ فِي الذَّكَرِ وَالْأُنْثَى لِتِسْعِ سِنِينَ، وَالْحَيْضُ فِي الْأُنْثَى لِتِسْعِ سِنِينَ.',
            translatedText: 'Tanda-tanda baligh (dewasa secara syariat) ada tiga perkara: (1) Sempurna umur 15 tahun bagi laki-laki dan perempuan, (2) Mimpi basah pada laki-laki dan perempuan di usia minimal 9 tahun, (3) Haid bagi perempuan di usia minimal 9 tahun.',
            explanation: 'Jika salah satu tanda ini tampak, maka orang tersebut sudah dibebankan hukum taklif (kewajiban syariat).'
          }
        ]
      }
    ]
  },
  {
    id: 'kitab-3',
    title: 'Riyadhus Shalihin',
    arabicTitle: 'رياض الصالحين',
    category: 'Hadis Nabawi',
    author: 'Imam Abu Zakaria Yahya bin Syaraf An-Nawawi',
    description: 'Kumpulan hadis-hadis shahih tuntunan kehidupan sehari-hari, akhlak, keutamaan amal, serta pembinaan mental spiritual muslim.',
    difficulty: 'Menengah',
    chaptersCount: 1,
    chapters: [
      {
        id: 'k3-ch1',
        title: 'Bab 1: Keikhlasan & Niat',
        arabicTitle: 'بَابُ الْإِخْلَاصِ وَإِحْضَارِ النِّيَّةِ',
        sections: [
          {
            id: 'k3-c1-s1',
            subTitle: 'Pasal 1: Hadis Pertama tentang Niat',
            arabicText: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ...',
            translatedText: 'Sesungguhnya setiap amalan itu bergantung pada niatnya, dan seseorang hanya akan mendapatkan balasan sesuai apa yang diniatkannya. Barangsiapa berhijrah karena Allah dan Rasul-Nya maka hijrahnya dicatat di sisi Allah dan Rasul-Nya...',
            explanation: 'Hadis mutawatir sanad ini menjelaskan pentingnya menetapkan niat ikhlas murni mengharap ridha Allah agar amal perbuatan dinilai sah secara ruhani.'
          }
        ]
      }
    ]
  }
];

export const MOCK_SURAHS: QuranSurah[] = [
  {
    number: 1,
    name: 'Al-Fatihah',
    englishName: 'Al-Fatiha',
    englishNameTranslation: 'Pembukaan',
    numberOfAyahs: 7,
    revelationType: 'Makkiyah',
    verses: [
      {
        number: 1,
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'Dengan menyebut nama Allah Yang Maha Pengasih lagi Maha Penyayang.',
        tafsir: 'Memulai membaca mushaf dengan basmalah sebagai bentuk memohon keberkahan pada nama Allah yang suci.'
      },
      {
        number: 2,
        text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        translation: 'Segala puji bagi Allah, Tuhan seluruh alam.',
        tafsir: 'Pujian mutlak hanya milik Allah yang memelihara, mematangkan, dan mengontrol alam semesta tanpa tandingan.'
      },
      {
        number: 3,
        text: 'الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'Yang Maha Pengasih lagi Maha Penyayang.',
        tafsir: 'Ar-Rahman adalah rahmat umum bagi seluruh makhluk di dunia, sedangkan Ar-Rahim khusus bagi hamba mukmin di akhirat.'
      },
      {
        number: 4,
        text: 'مَالِكِ يَوْمِ الدِّينِ',
        translation: 'Pemilik Hari Pembalasan.',
        tafsir: 'Menegaskan kedaulatan mutlak Allah di hari kiamat di mana tidak ada kekuasaan lain yang berlaku sedikit pun.'
      },
      {
        number: 5,
        text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        translation: 'Hanya kepada-Kaulah kami menyembah dan hanya kepada-Kaulah kami memohon pertolongan.',
        tafsir: 'Pernyataan tauhid murni, membebaskan diri dari perbuatan syirik sekaligus menyatakan kepasrahan total atas pertolongan-Nya.'
      },
      {
        number: 6,
        text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        translation: 'Tunjukkanlah kami jalan yang lurus,',
        tafsir: 'Permohonan hidayah irsyad (petunjuk) dan hidayah taufiq (kemampuan mengamalkan jalan kebenaran Islam).'
      },
      {
        number: 7,
        text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
        translation: '(yaitu) jalan orang-orang yang telah Engkau beri nikmat kepadanya; bukan (jalan) mereka yang dimurkai, dan bukan (pula jalan) mereka yang sesat.',
        tafsir: 'Yaitu jalan para nabi, siddiqin, syuhada dan shalihin. Bukan jalan orang yahudi yang berilmu tapi membangkang, bukan pula orang nashrani yang beribadah tanpa ilmu.'
      }
    ]
  },
  {
    number: 67,
    name: 'Al-Mulk',
    englishName: 'Al-Mulk',
    englishNameTranslation: 'Kerajaan',
    numberOfAyahs: 5,
    revelationType: 'Makkiyah',
    verses: [
      {
        number: 1,
        text: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
        translation: 'Maha Suci Allah yang menguasai (segala) kerajaan, dan Dia Maha Kuasa atas segala sesuatu.',
        tafsir: 'Allah melimpah berkah-Nya secara meluas, menggenggam mutlak kendali makrokosmos dan mikrokosmos.'
      },
      {
        number: 2,
        text: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ',
        translation: 'Yang menciptakan kematian dan kehidupan, untuk menguji kamu, siapa di antara kamu yang lebih baik amalnya. Dan Dia Maha Perkasa, Maha Pengampun,',
        tafsir: 'Tujuan dicantumkannya ajal dan hayat adalah penyaringan bagi integritas keikhlasan dan ketepatan amal hamba.'
      },
      {
        number: 3,
        text: 'الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلَقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ ۖ فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ',
        translation: 'Yang menciptakan tujuh langit berlapis-lapis. Kamu tidak akan melihat pada ciptaan Tuhan Yang Maha Pengasih sesuatu yang tidak seimbang. Maka tataplah berulang-ulang, adakah kamu melihat sesuatu yang cacat?',
        tafsir: 'Bukti orisinalitas kesempurnaan ciptaan-Nya tanpa cacat, mengajak manusia bertafakur merenungi alam raya.'
      }
    ]
  }
];

export const MOCK_KAMUS: KamusTerm[] = [
  {
    word: 'Mutaqin',
    arabic: 'الْمُتَّقِينَ',
    category: 'Sifat Mukmin',
    definition: 'Orang-orang berkualifikasi takwa yang senantiasa menjaga dirinya dari azab Allah dengan cara mematuhi segala perintah-Nya dan menjauhi larangan-Nya.',
    example: 'هُدًى لِّلْمُتَّقِينَ',
    exampleTranslation: 'Petunjuk bagi mereka yang bertakwa (QS. Al-Baqarah: 2)'
  },
  {
    word: 'Shalat',
    arabic: 'الصَّلَاةَ',
    category: 'Fiqih / Ibadah',
    definition: 'Ibadah ritual khusus yang diawali dengan takbiratul ihram dan diakhiri dengan salam, dengan syarat dan rukun tertentu guna ruku dan sujud menyembah kepada Allah.',
    example: 'وَيُقِيمُونَ الصَّلَاةَ',
    exampleTranslation: 'Dan mereka mendirikan shalat (QS. Al-Baqarah: 3)'
  },
  {
    word: 'Sabar',
    arabic: 'الصَّبْرُ',
    category: 'Akhlaq',
    definition: 'Menahan diri serta mengontrol emosi ketika ditimpa musibah, tetap tegar di jalan ketaatan kepada Allah, serta konsisten menghindari godaan maksiat.',
    example: 'اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ',
    exampleTranslation: 'Jadikanlah sabar dan shalat sebagai penolongmu (QS. Al-Baqarah: 153)'
  }
];

export const MOCK_HADISES: HadisItem[] = [
  {
    id: 'hd-1',
    title: 'Pentingnya Menuntut Ilmu',
    arabicText: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ.',
    translatedText: 'Menuntut ilmu itu adalah kewajiban fardhu bagi setiap orang muslim (baik laki-laki maupun perempuan).',
    narrator: 'HR. Ibnu Majah (No. 224, dinilai shahih oleh Syaikh Al-Albani)',
    explanation: 'Ilmu yang diwajibkan adalah ilmu fardhu ain, yaitu pokok-pokok aqidah Islam, cara bersuci shalat sehari-hari, serta kewajiban dasar lainnya yang menunjang kesempurnaan ubudiyah hamba.'
  },
  {
    id: 'hd-2',
    title: 'Adab Berbuat Baik & Menghormati Tamu',
    arabicText: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ جَارَهُ...',
    translatedText: 'Barangsiapa beriman kepada Allah dan Hari Akhir, maka hendaklah dia berkata yang baik atau diam. Dan barangsiapa beriman kepada Allah dan Hari Akhir maka muliakanlah tetangganya dan muliakan kawannya...',
    narrator: 'HR. Bukhari (No. 6018) dan Muslim (No. 47)',
    explanation: 'Keimanan tercermin erat dalam etika sosial kemasyarakatan sehari-hari, khususnya menjaga lisan dari menyakiti orang lain serta menghormati tetangga.'
  }
];
