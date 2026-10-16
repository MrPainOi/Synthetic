/**
 * Script Pembaruan Basis Data HS Code BTKI
 * Berdasarkan Publikasi Resmi Direktorat Jenderal Bea dan Cukai (DJBC)
 * Sumber: https://www.beacukai.go.id/btki-dan-tarif#
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'temp', 'hscode.db');

if (!fs.existsSync(DB_PATH)) {
    console.error('[ERROR] Database hscode.db belum ada di:', DB_PATH);
    process.exit(1);
}

// 21 Sections Resmi BTKI 2022 (Bahasa Indonesia & English)
const SECTIONS = [
    {
        roman: "I",
        nameId: "BINATANG HIDUP; PRODUK HEWANI",
        nameEn: "LIVE ANIMALS; ANIMAL PRODUCTS",
        chapters: ["01", "02", "03", "04", "05"]
    },
    {
        roman: "II",
        nameId: "PRODUK NABATI",
        nameEn: "VEGETABLE PRODUCTS",
        chapters: ["06", "07", "08", "09", "10", "11", "12", "13", "14"]
    },
    {
        roman: "III",
        nameId: "LEMAK DAN MINYAK HEWANI ATAU NABATI SERTA PRODUK DISOSIASINYA; LEMAK OLAHAN; MALAM",
        nameEn: "ANIMAL, VEGETABLE OR MICROBIAL FATS AND OILS AND THEIR CLEAVAGE PRODUCTS; PREPARED EDIBLE FATS; ANIMAL OR VEGETABLE WAXES",
        chapters: ["15"]
    },
    {
        roman: "IV",
        nameId: "PRODUK INDUSTRI MAKANAN; MINUMAN, CUKA; TEMBAKAU DAN ROKOK ELEKTRIK",
        nameEn: "PREPARED FOODSTUFFS; BEVERAGES, SPIRITS AND VINEGAR; TOBACCO AND MANUFACTURED TOBACCO SUBSTITUTES; PRODUCTS INTENDED FOR INHALATION",
        chapters: ["16", "17", "18", "19", "20", "21", "22", "23", "24"]
    },
    {
        roman: "V",
        nameId: "PRODUK MINERAL",
        nameEn: "MINERAL PRODUCTS",
        chapters: ["25", "26", "27"]
    },
    {
        roman: "VI",
        nameId: "PRODUK INDUSTRI KIMIA ATAU INDUSTRI TERKAIT",
        nameEn: "PRODUCTS OF THE CHEMICAL OR ALLIED INDUSTRIES",
        chapters: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"]
    },
    {
        roman: "VII",
        nameId: "PLASTIK DAN BARANG DARI PLASTIK; KARET DAN BARANG DARI KARET",
        nameEn: "PLASTICS AND ARTICLES THEREOF; RUBBER AND ARTICLES THEREOF",
        chapters: ["39", "40"]
    },
    {
        roman: "VIII",
        nameId: "KULIT MENTAH, KULIT SAMAK, KULIT BERBULU; BARANG PELANA; TAS TANGAN",
        nameEn: "RAW HIDES AND SKINS, LEATHER, FURSKINS AND ARTICLES THEREOF; SADDLERY AND HARNESS; TRAVEL GOODS, HANDBAGS",
        chapters: ["41", "42", "43"]
    },
    {
        roman: "IX",
        nameId: "KAYU DAN BARANG DARI KAYU; ARANG KAYU; GABUS; BARANG KERANJANG DAN ANYAMAN",
        nameEn: "WOOD AND ARTICLES OF WOOD; WOOD CHARCOAL; CORK; BASKETWARE AND WICKERWORK",
        chapters: ["44", "45", "46"]
    },
    {
        roman: "X",
        nameId: "PULP KAYU; KERTAS DAN KARTON PULIHAN; KERTAS DAN KARTON SERTA BARANGNYA",
        nameEn: "PULP OF WOOD; RECOVERED PAPER OR PAPERBOARD; PAPER AND PAPERBOARD AND ARTICLES THEREOF",
        chapters: ["47", "48", "49"]
    },
    {
        roman: "XI",
        nameId: "TEKSTIL DAN BARANG TEKSTIL",
        nameEn: "TEXTILES AND TEXTILE ARTICLES",
        chapters: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"]
    },
    {
        roman: "XII",
        nameId: "ALAS KAKI, TUTUP KEPALA, PAYUNG, TONGKAT JALAN; BULU UNGGAS OLAHAN; BUNGA TIRUAN",
        nameEn: "FOOTWEAR, HEADGEAR, UMBRELLAS, SUN UMBRELLAS, WALKING-STICKS; PREPARED FEATHERS; ARTIFICIAL FLOWERS",
        chapters: ["64", "65", "66", "67"]
    },
    {
        roman: "XIII",
        nameId: "BARANG DARI BATU, GIPS, SEMEN, ASBES, MIKA; KERAMIK; KACA DAN BARANG DARI KACA",
        nameEn: "ARTICLES OF STONE, PLASTER, CEMENT, ASBESTOS, MICA; CERAMIC PRODUCTS; GLASS AND GLASSWARE",
        chapters: ["68", "69", "70"]
    },
    {
        roman: "XIV",
        nameId: "MUTIARA ALAM, BATU MULIA, LOGAM MULIA, PERHIASAN IMITASI, KOIN",
        nameEn: "NATURAL OR CULTURED PEARLS, PRECIOUS STONES, PRECIOUS METALS, IMITATION JEWELLERY; COIN",
        chapters: ["71"]
    },
    {
        roman: "XV",
        nameId: "LOGAM DASAR DAN BARANG DARI LOGAM DASAR",
        nameEn: "BASE METALS AND ARTICLES OF BASE METAL",
        chapters: ["72", "73", "74", "75", "76", "78", "79", "80", "81", "82", "83"]
    },
    {
        roman: "XVI",
        nameId: "MESIN DAN PERALATAN MEKANIS; PERALATAN LISTRIK; PEREKAM SUARA DAN GAMBAR",
        nameEn: "MACHINERY AND MECHANICAL APPLIANCES; ELECTRICAL EQUIPMENT; SOUND AND TELEVISION RECORDERS AND REPRODUCERS",
        chapters: ["84", "85"]
    },
    {
        roman: "XVII",
        nameId: "KENDARAAN, PESAWAT UDARA, KAPAL DAN PERLENGKAPAN PENGANGKUTAN",
        nameEn: "VEHICLES, AIRCRAFT, VESSELS AND ASSOCIATED TRANSPORT EQUIPMENT",
        chapters: ["86", "87", "88", "89"]
    },
    {
        roman: "XVIII",
        nameId: "INSTRUMEN OPTIK, FOTOGRAFI, PENGUKUR, MEDIS/BEDAH; ARLOJI; INSTRUMEN MUSIK",
        nameEn: "OPTICAL, PHOTOGRAPHIC, MEASURING, CHECKING, PRECISION, MEDICAL OR SURGICAL INSTRUMENTS; CLOCKS AND WATCHES; MUSICAL INSTRUMENTS",
        chapters: ["90", "91", "92"]
    },
    {
        roman: "XIX",
        nameId: "SENJATA DAN AMUNISI; BAGIAN DAN AKSESORINYA",
        nameEn: "ARMS AND AMMUNITION; PARTS AND ACCESSORIES THEREOF",
        chapters: ["93"]
    },
    {
        roman: "XX",
        nameId: "BERBAGAI HASIL PABRIK (FURNITUR, LAMPU, MAINAN, ALAT TULIS)",
        nameEn: "MISCELLANEOUS MANUFACTURED ARTICLES (FURNITURE, LIGHTING, TOYS, STATIONERY)",
        chapters: ["94", "95", "96"]
    },
    {
        roman: "XXI",
        nameId: "KARYA SENI, BARANG KOLEKSI DAN BARANG ANTIK",
        nameEn: "WORKS OF ART, COLLECTORS' PIECES AND ANTIQUES",
        chapters: ["97"]
    }
];

// Peta 96 Chapter Resmi dari https://www.beacukai.go.id/btki-dan-tarif
const CHAPTER_DATA = {
    "01": {
        titleEn: "Live animals.",
        titleId: "Binatang Hidup",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/d4ffeb744a3ac786f5bf0ad344b0982e-chapter-1-(converted).pdf"
    },
    "02": {
        titleEn: "Meat and edible meat offal.",
        titleId: "Daging dan Jeroan yang dapat dimakan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/211e2e72b754ec0608f783fceb68c597-chapter-2-(converted).pdf"
    },
    "03": {
        titleEn: "Fish and crustaceans, molluscs and other aquatic invertebrates.",
        titleId: "Ikan dan Binatang Air Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9745e10f5025a90e0fb4960b9e2f99d4-chapter-3-(converted).pdf"
    },
    "04": {
        titleEn: "Dairy produce; birds' eggs; natural honey; edible products of animal origin, not elsewhere specified or included.",
        titleId: "Produk Susu; Telur Burung; Madu Alam; Produk Pangan Hewani",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/29f219ed9b96f2570a04f7ecfcdb0854-chapter-4-(converted).pdf"
    },
    "05": {
        titleEn: "Products of animal origin, not elsewhere specified or included.",
        titleId: "Produk Hewani Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/372e536d0264b1ab743b245fca25bb8b-chapter-5-(converted).pdf"
    },
    "06": {
        titleEn: "Live trees and other plants; bulbs, roots and the like; cut flowers and ornamental foliage.",
        titleId: "Tanaman Hidup dan Produk Floristik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/b175813b38b035d109b66c6c4e454428-chapter-6-(converted).pdf"
    },
    "07": {
        titleEn: "Edible vegetables and certain roots and tubers.",
        titleId: "Sayuran dan Akar serta Umbi yang dapat dimakan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/2a3a7583178b15d5830bf605d4955a43-chapter-7-(converted).pdf"
    },
    "08": {
        titleEn: "Edible fruit and nuts; peel of citrus fruit or melons.",
        titleId: "Buah dan Kacang yang dapat dimakan; Kulit Jeruk atau Melon",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/50b27c9d70bb6199637193f22bd480dc-chapter-8-(converted).pdf"
    },
    "09": {
        titleEn: "Coffee, tea, maté and spices.",
        titleId: "Kopi, Teh, Mate dan Rempah-rempah",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e9e7bdb771c932d68ac3c2aaa665b8a7-chapter-9-(converted).pdf"
    },
    "10": {
        titleEn: "Cereals.",
        titleId: "Serealia",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/550b2e47a2e3e77e6aa4ee643d723a30-chapter-10-(converted).pdf"
    },
    "11": {
        titleEn: "Products of the milling industry; malt; starches; inulin; wheat gluten.",
        titleId: "Produk Industri Penggilingan; Malt; Pati; Inulin; Gluten Gandum",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/6e0e3730d4753db460e9553536ca2597-chapter-11-(converted).pdf"
    },
    "12": {
        titleEn: "Oil seeds and oleaginous fruits; miscellaneous grains, seeds and fruit; industrial or medicinal plants; straw and fodder.",
        titleId: "Biji-bijian Minyak; Biji-bijian Industri atau Obat; Jerami dan Pakan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/10aa667fe6cb140f69ad93e430ca95bf-chapter-12-(converted).pdf"
    },
    "13": {
        titleEn: "Lac; gums, resins and other vegetable saps and extracts.",
        titleId: "Lak; Karet, Resin dan Getah Nabati Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/60a221f7c23bc949d115e6191b5c4900-chapter-13-(converted).pdf"
    },
    "14": {
        titleEn: "Vegetable plaiting materials; vegetable products not elsewhere specified or included.",
        titleId: "Bahan Nabati untuk Anyaman; Produk Nabati Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/f3a0937a44f128be2da2c85f750c1f60-chapter-14-(converted).pdf"
    },
    "15": {
        titleEn: "Animal, vegetable or microbial fats and oils and their cleavage products; prepared edible fats; animal or vegetable waxes.",
        titleId: "Lemak dan Minyak Hewani atau Nabati; Produk Turunannya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/240cfc24d47e44ebf93e9611681b994d-chapter-15.pdf"
    },
    "16": {
        titleEn: "Preparations of meat, of fish, of crustaceans, molluscs or other aquatic invertebrates, or of insects.",
        titleId: "Olahan Daging, Ikan atau Binatang Air Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/23f81e350567f1bbf5109b0b4869e5d4-chapter-16.pdf"
    },
    "17": {
        titleEn: "Sugars and sugar confectionery.",
        titleId: "Gula dan Kembang Gula",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e306132dd0d5e16544be7163f886f45b-chapter-17.pdf"
    },
    "18": {
        titleEn: "Cocoa and cocoa preparations.",
        titleId: "Kakao dan Olahan Kakao",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0d44be8e8557d97960fae24beae71a62-chapter-18.pdf"
    },
    "19": {
        titleEn: "Preparations of cereals, flour, starch or milk; bakers' wares.",
        titleId: "Olahan Serealia, Tepung, Pati atau Susu; Produk Industri Kue",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0bbf80d6f4618e80eaee8a798b03e05a-chapter-19.pdf"
    },
    "20": {
        titleEn: "Preparations of vegetables, fruit, nuts or other parts of plants.",
        titleId: "Olahan Sayuran, Buah, Kacang atau Bagian Tanaman Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/75e9f85c13e551ea3671239c4a8ee1b6-chapter-20.pdf"
    },
    "21": {
        titleEn: "Miscellaneous edible preparations.",
        titleId: "Berbagai Olahan Makanan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/24e0fb4d4ebcc24b53ef5bb3be57a5e8-chapter-21.pdf"
    },
    "22": {
        titleEn: "Beverages, spirits and vinegar.",
        titleId: "Minuman, Cairan Beralkohol dan Cuka",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/4921ea0283f2ff474b0c793ff8ea6c4d-chapter-22.pdf"
    },
    "23": {
        titleEn: "Residues and waste from the food industries; prepared animal fodder.",
        titleId: "Ampas dan Limbah Industri Pangan; Pakan Olahan Hewan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/d9ee7caea04561a0f8bf3a94833a6b57-chapter-23.pdf"
    },
    "24": {
        titleEn: "Tobacco and manufactured tobacco substitutes; products, whether or not containing nicotine, intended for inhalation without combustion; other nicotine containing products intended for the intake of nicotine into the human body.",
        titleId: "Tembakau dan Pengganti Tembakau Olahan; Rokok Elektrik & Produk Nikotin",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0f43b67c337ddaa5ee0322bf2f389f4b-chapter-24.pdf"
    },
    "25": {
        titleEn: "Salt; sulphur; earths and stone; plastering materials, lime and cement.",
        titleId: "Garam; Belerang; Bumi dan Batu; Plester; Kapur dan Semen",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/2da4bf4baecfc6522cbb54d00df73bc0-chapter-25.pdf"
    },
    "26": {
        titleEn: "Ores, slag and ash.",
        titleId: "Bijih, Terak dan Abu",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/d91d179aa2f5a092a7f53f938a167d4e-chapter-26.pdf"
    },
    "27": {
        titleEn: "Mineral fuels, mineral oils and products of their distillation; bituminous substances; mineral waxes.",
        titleId: "Bahan Bakar Mineral; Minyak Mineral dan Produk Destilasi",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e67839353982e071987588e1041ddca4-chapter-27.pdf"
    },
    "28": {
        titleEn: "Inorganic chemicals; organic or inorganic compounds of precious metals, of rare-earth metals, of radioactive elements or of isotopes.",
        titleId: "Bahan Kimia Anorganik; Senyawa Organik atau Anorganik dari Logam Mulia",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/fa3557454c7d91fa7442eb12810a905a-chapter-28.pdf"
    },
    "29": {
        titleEn: "Organic chemicals.",
        titleId: "Bahan Kimia Organik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/2eb14d79b29cf1639c43b95be673b503-chapter-29.pdf"
    },
    "30": {
        titleEn: "Pharmaceutical products.",
        titleId: "Produk Farmasi",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0d4beae518c7d0d026779426d0e6538b-chapter-30.pdf"
    },
    "31": {
        titleEn: "Fertilisers.",
        titleId: "Pupuk",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0d36cfae8bf697ec09689694ff8a3560-chapter-31.pdf"
    },
    "32": {
        titleEn: "Tanning or dyeing extracts; tannins and their derivatives; dyes, pigments and other colouring matter; paints and varnishes; putty and other mastics; inks.",
        titleId: "Ekstrak Penyamak atau Pencelup; Tanin; Zat Warna; Cat; Tinta",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/27653bb4621c5fdf69654167191147a4-chapter-32.pdf"
    },
    "33": {
        titleEn: "Essential oils and resinoids; perfumery, cosmetic or toilet preparations.",
        titleId: "Minyak Atsiri dan Resinoid; Parfum, Kosmetik, Preparat Toilet",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/4cb85c182281cf71df7e44a7f9202562-chapter-33.pdf"
    },
    "34": {
        titleEn: "Soap, organic surface-active agents, washing preparations, lubricating preparations, artificial waxes, prepared waxes, polishing or scouring preparations, candles and similar articles, modelling pastes, 'dental waxes' and dental preparations with a basis of plaster.",
        titleId: "Sabun, Preparat Pembersih, Pelumas, Lilin, Preparat Pemoles, Pasta Gigi",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/a3a60a87f16805c86685122e23292433-chapter-34.pdf"
    },
    "35": {
        titleEn: "Albuminoidal substances; modified starches; glues; enzymes.",
        titleId: "Zat Albumin; Pati Termodifikasi; Lem; Enzim",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/aa0c184d0084511516f167ff5085d778-chapter-35.pdf"
    },
    "36": {
        titleEn: "Explosives; pyrotechnic products; matches; pyrophoric alloys; certain combustible preparations.",
        titleId: "Bubuk Mesiu dan Bahan Peledak; Kembang Api; Korek Api",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/108ecf66299b8004f8661879aa1dfd71-chapter-36.pdf"
    },
    "37": {
        titleEn: "Photographic or cinematographic goods.",
        titleId: "Produk Fotografi dan Sinematografi",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/ff6f2d250d0d8fb1777d111c107be639-chapter-37.pdf"
    },
    "38": {
        titleEn: "Miscellaneous chemical products.",
        titleId: "Berbagai Produk Kimia",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/7df8e854fa12ba4d0f6df41c1950d995-chapter-38.pdf"
    },
    "39": {
        titleEn: "Plastics and articles thereof.",
        titleId: "Plastik dan Barang dari Plastik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e3d069a8b1be4000305a49806509f6bf-chapter-39.pdf"
    },
    "40": {
        titleEn: "Rubber and articles thereof.",
        titleId: "Karet dan Barang dari Karet",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/34e8f19da26c11b1c67d6a2fbe659146-chapter-40.pdf"
    },
    "41": {
        titleEn: "Raw hides and skins (other than furskins) and leather.",
        titleId: "Kulit Mentah (selain Bulu Hewan) dan Kulit Samak",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/617da558f33c30ea515d16ccb2365bf0-chapter-41.pdf"
    },
    "42": {
        titleEn: "Articles of leather; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut (other than silk-worm gut).",
        titleId: "Barang dari Kulit; Barang Pelana; Perlengkapan Perjalanan, Tas Tangan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/fceca785fe77b4d3a0e69b0fa2a4f4ef-chapter-42.pdf"
    },
    "43": {
        titleEn: "Furskins and artificial fur; manufactures thereof.",
        titleId: "Bulu Hewan dan Bulu Imitasi; Barang Daripadanya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/8d356784a0d9b4be4ca03fae8aa4b3ca-chapter-43.pdf"
    },
    "44": {
        titleEn: "Wood and articles of wood; wood charcoal.",
        titleId: "Kayu dan Barang dari Kayu; Arang Kayu",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/52e93d9ca58aa488da11786c5f7d3a23-chapter-44.pdf"
    },
    "45": {
        titleEn: "Cork and articles of cork.",
        titleId: "Gabus dan Barang dari Gabus",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/a3ad84eecda8943714b7e9bf7230b42c-chapter-45.pdf"
    },
    "46": {
        titleEn: "Manufactures of straw, of esparto or of other plaiting materials; basketware and wickerwork.",
        titleId: "Barang dari Jerami, Esparto atau Bahan Anyaman Lainnya; Barang Keranjang",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/936829ce38ef42691fa30a84d416b251-chapter-46.pdf"
    },
    "47": {
        titleEn: "Pulp of wood or of other fibrous cellulosic material; recovered (waste and scrap) paper or paperboard.",
        titleId: "Pulp dari Kayu atau Bahan Berserat Selulosa Lainnya; Kertas/Karton Bekas",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e63e2646d2da5e22709214777a85822b-chapter-47.pdf"
    },
    "48": {
        titleEn: "Paper and paperboard; articles of paper pulp, of paper or of paperboard.",
        titleId: "Kertas dan Karton; Barang dari Pulp Kertas, Kertas atau Karton",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/6e22f2ee471e411bfe662f567fbf7bdf-chapter-48.pdf"
    },
    "49": {
        titleEn: "Printed books, newspapers, pictures and other products of the printing industry; manuscripts, typescripts and plans.",
        titleId: "Buku Cetakan, Surat Kabar, Gambar dan Produk Percetakan Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/0d0246fc140e7d56e797a737fba143ff-chapter-49.pdf"
    },
    "50": {
        titleEn: "Silk.",
        titleId: "Sutera",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e627fc0f68d90be71261a09d3b38153b-chapter-50.pdf"
    },
    "51": {
        titleEn: "Wool, fine or coarse animal hair; horsehair yarn and woven fabric.",
        titleId: "Wol, Bulu Hewan Halus atau Kasar; Benang Kuda dan Kain Tenun",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/2f447ce4eb0f288e7aa237750c18d3cf-chapter-51.pdf"
    },
    "52": {
        titleEn: "Cotton.",
        titleId: "Kapas",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/49ae4a919313cb6ee211ee4db9ae7bf7-chapter-52.pdf"
    },
    "53": {
        titleEn: "Other vegetable textile fibres; paper yarn and woven fabrics of paper yarn.",
        titleId: "Serat Nabati Tekstil Lainnya; Benang Kertas dan Kain Tenun Benang Kertas",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/93138b248a3794695e1ee38965f32ebf-chapter-53.pdf"
    },
    "54": {
        titleEn: "Man-made filaments; strip and the like of man-made textile materials.",
        titleId: "Filamen Buatan; Strip dan Sejenisnya dari Bahan Tekstil Buatan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/f30536c4b2b6c9ddb53c7d6c62c94380-chapter-54.pdf"
    },
    "55": {
        titleEn: "Man-made staple fibres.",
        titleId: "Serat Stapel Buatan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e0018a9be1c4e12e22c4fcfb215886ae-chapter-55.pdf"
    },
    "56": {
        titleEn: "Wadding, felt and nonwovens; special yarns; twine, cordage, ropes and cables and articles thereof.",
        titleId: "Gumpalan, Kain Kempa dan Bukan Tenunan; Benang Khusus; Tali",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/7978e89f81f185efdbe5da362d29486c-chapter-56.pdf"
    },
    "57": {
        titleEn: "Carpets and other textile floor coverings.",
        titleId: "Karpet dan Penutup Lantai Tekstil Lainnya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/ff6bfdb9f2b8a4f6cf41eb93a8cf037f-chapter-57.pdf"
    },
    "58": {
        titleEn: "Special woven fabrics; tufted textile fabrics; lace; tapestries; trimmings; embroidery.",
        titleId: "Kain Tenun Khusus; Renda; Tapestri; Sulaman",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/e32230da371db4e2bf8b3b3cb911463e-chapter-58.pdf"
    },
    "59": {
        titleEn: "Impregnated, coated, covered or laminated textile fabrics; textile articles of a kind suitable for industrial use.",
        titleId: "Kain Tekstil Diresapi, Dilapisi atau Dilaminasi; Barang Tekstil Industri",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/6d860d5eb207ecaa2ea33261771fc99b-chapter-59.pdf"
    },
    "60": {
        titleEn: "Knitted or crocheted fabrics.",
        titleId: "Kain Rajutan atau Kait",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/178556f8f74a00445a47895d31519d5c-chapter-60.pdf"
    },
    "61": {
        titleEn: "Articles of apparel and clothing accessories, knitted or crocheted.",
        titleId: "Pakaian dan Aksesori Pakaian; Rajutan atau Kait",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/be7ff93c407887e5ccca568d27a4d57c-chapter-61.pdf"
    },
    "62": {
        titleEn: "Articles of apparel and clothing accessories, not knitted or crocheted.",
        titleId: "Pakaian dan Aksesori Pakaian; Bukan Rajutan atau Kait",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/aab1000c00b67cb7c231e11c3a281074-chapter-62.pdf"
    },
    "63": {
        titleEn: "Other made up textile articles; sets; worn clothing and worn textile articles; rags.",
        titleId: "Barang Tekstil Jadi Lainnya; Pakaian Bekas dan Kain Bekas",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/6123fbc242bac81df310db711e633156-chapter-63.pdf"
    },
    "64": {
        titleEn: "Footwear, gaiters and the like; parts of such articles.",
        titleId: "Alas Kaki; Pelindung Kaki dan Bagian dari Barang Tersebut",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/879792c629b94d81282310523c31938f-chapter-64.pdf"
    },
    "65": {
        titleEn: "Headgear and parts thereof.",
        titleId: "Tutup Kepala dan Bagiannya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/a829524cd2f9fa8e0387ca5e47d22700-chapter-65.pdf"
    },
    "66": {
        titleEn: "Umbrellas, sun umbrellas, walking-sticks, seat-sticks, whips, riding-crops and parts thereof.",
        titleId: "Payung, Payung Matahari, Tongkat Jalan, Cambuk, Pecut",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/4fbe018280347eb361fa459310fbc730-chapter-66.pdf"
    },
    "67": {
        titleEn: "Prepared feathers and down and articles made of feathers or of down; artificial flowers; articles of human hair.",
        titleId: "Bulu Unggas Olahan; Bunga Buatan; Barang dari Rambut Manusia",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9d1f804f24549b8819bc1f7cbdabb7a9-chapter-67.pdf"
    },
    "68": {
        titleEn: "Articles of stone, plaster, cement, asbestos, mica or similar materials.",
        titleId: "Barang dari Batu, Gips, Semen, Asbes, Mika atau Bahan Sejenis",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9ce3a9df55c7b0414474d699ed42da6c-chapter-68.pdf"
    },
    "69": {
        titleEn: "Ceramic products.",
        titleId: "Produk Keramik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/bf666ed4f1b786b36592c8cb290f0382-chapter-69.pdf"
    },
    "70": {
        titleEn: "Glass and glassware.",
        titleId: "Kaca dan Barang dari Kaca",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/a7879c801cafe0090d3193b8e5515d59-chapter-70.pdf"
    },
    "71": {
        titleEn: "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal and articles thereof; imitation jewellery; coin.",
        titleId: "Mutiara, Batu Mulia, Logam Mulia, Perhiasan Imitasi, Koin",
        pdfUrl: "http://repository.beacukai.go.id/download/2022/03/390ad1738903f52e5e803f606449e957-chapter-71.pdf"
    },
    "72": {
        titleEn: "Iron and steel.",
        titleId: "Besi dan Baja",
        pdfUrl: "http://repository.beacukai.go.id/download/2022/03/5e5e3bb4404056403be4dd63773c49dd-chapter-72.pdf"
    },
    "73": {
        titleEn: "Articles of iron or steel.",
        titleId: "Barang dari Besi atau Baja",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9bb99a9fb54734aa764f625de9ae63eb-chapter-73.pdf"
    },
    "74": {
        titleEn: "Copper and articles thereof.",
        titleId: "Tembaga dan Barang dari Tembaga",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/7c000e46067caeddd4ab8b24f6af96b3-chapter-74.pdf"
    },
    "75": {
        titleEn: "Nickel and articles thereof.",
        titleId: "Nikel dan Barang dari Nikel",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/f909310e2fea220aa6468cb6f5fef1da-chapter-75.pdf"
    },
    "76": {
        titleEn: "Aluminium and articles thereof.",
        titleId: "Aluminium dan Barang dari Aluminium",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/c7d5992259eec1bcd238aa83605e171e-chapter-76.pdf"
    },
    "78": {
        titleEn: "Lead and articles thereof.",
        titleId: "Timbal dan Barang dari Timbal",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/980e24a4c8610245bff889d196741cf2-chapter-78.pdf"
    },
    "79": {
        titleEn: "Zinc and articles thereof.",
        titleId: "Seng dan Barang dari Seng",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/70589489a1efb875d7281f92a2ef5c02-chapter-79.pdf"
    },
    "80": {
        titleEn: "Tin and articles thereof.",
        titleId: "Timah dan Barang dari Timah",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/8b930e797502548467cbe9e2a8240750-chapter-80.pdf"
    },
    "81": {
        titleEn: "Other base metals; cermets; articles thereof.",
        titleId: "Logam Dasar Lainnya; Cermet; Barang Daripadanya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/2c773795fbc16ab5a2474d1227f66875-chapter-81.pdf"
    },
    "82": {
        titleEn: "Tools, implements, cutlery, spoons and forks, of base metal; parts thereof of base metal.",
        titleId: "Perkakas, Sendok Garpu dan Pisau dari Logam Dasar",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/c9a438409a5d417c2f221dd400eb034b-chapter-82.pdf"
    },
    "83": {
        titleEn: "Miscellaneous articles of base metal.",
        titleId: "Berbagai Barang dari Logam Dasar",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/7e9881b8ba675b0ccbbc0e456a049d32-chapter-83.pdf"
    },
    "84": {
        titleEn: "Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof.",
        titleId: "Reaktor Nuklir, Ketel Uap, Mesin dan Peralatan Mekanik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/3b564ac9fa2e6ee3ec10d87b59f3e9c0-chapter-84.pdf"
    },
    "85": {
        titleEn: "Electrical machinery and equipment and parts thereof; sound recorders and reproducers, television image and sound recorders and reproducers, and parts and accessories of such articles.",
        titleId: "Mesin, Peralatan Listrik dan Elektronik; Perekam Suara & Gambar",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/a9e033e776c2f740a53f5d005de0c727-chapter-85.pdf"
    },
    "86": {
        titleEn: "Railway or tramway locomotives, rolling-stock and parts thereof; railway or tramway track fixtures and fittings and parts thereof; mechanical (including electro-mechanical) traffic signalling equipment of all kinds.",
        titleId: "Lokomotif, Gerbong Kereta Api; Perlengkapan Pensinyalan",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9abcb44b255d04b0cc9b79463182d5a7-chapter-86.pdf"
    },
    "87": {
        titleEn: "Vehicles other than railway or tramway rolling-stock, and parts and accessories thereof.",
        titleId: "Kendaraan Bermotor dan Bagian serta Aksesorinya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/545023d2e5abede7577a2794fb7dbfc7-chapter-87.pdf"
    },
    "88": {
        titleEn: "Aircraft, spacecraft, and parts thereof.",
        titleId: "Pesawat Udara, Pesawat Luar Angkasa dan Bagiannya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/1b39fca9376957679e1d6d6733d6876d-chapter-88.pdf"
    },
    "89": {
        titleEn: "Ships, boats and floating structures.",
        titleId: "Kapal, Perahu dan Struktur Terapung",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/9cf9a431bfeb3224b4effd322decf659-chapter-89.pdf"
    },
    "90": {
        titleEn: "Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments and apparatus; parts and accessories thereof.",
        titleId: "Instrumen Optik, Fotografi, Pengukur, Presisi, Medis/Bedah",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/1899672360710b606d1c5e0a43691747-chapter-90.pdf"
    },
    "91": {
        titleEn: "Clocks and watches and parts thereof.",
        titleId: "Jam Tangan, Jam dan Bagiannya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/fe266b1f3441259676cf3a9f0cffbeed-chapter-91.pdf"
    },
    "92": {
        titleEn: "Musical instruments; parts and accessories of such articles.",
        titleId: "Instrumen Musik; Bagian dan Aksesori Instrumen Musik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/bfe6303f11e29e2f1d4a5007ec04e02a-chapter-92.pdf"
    },
    "93": {
        titleEn: "Arms and ammunition; parts and accessories thereof.",
        titleId: "Senjata dan Amunisi; Bagian dan Aksesorinya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/56ccba2c41b516e46b285faebecd896a-chapter-93.pdf"
    },
    "94": {
        titleEn: "Furniture; bedding, mattresses, mattress supports, cushions and similar stuffed furnishings; luminaires and lighting fittings, not elsewhere specified or included; illuminated signs, illuminated name-plates and the like; prefabricated buildings.",
        titleId: "Furnitur; Kasur; Lampu dan Perlengkapan Pencahayaan; Bangunan Prefabrikasi",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/dae986d2994baeb91ff114f5eaba6617-chapter-94.pdf"
    },
    "95": {
        titleEn: "Toys, games and sports requisites; parts and accessories thereof.",
        titleId: "Mainan, Permainan dan Peralatan Olahraga; Bagian dan Aksesorinya",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/93225ab6cad7132bf34d85e31f41e421-chapter-95.pdf"
    },
    "96": {
        titleEn: "Miscellaneous manufactured articles.",
        titleId: "Berbagai Barang Jadi (Alat Tulis, Kancing, Sisir, dll)",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/d0a0cfe04fd2adabfdc8fb7fc1dad7a4-chapter-96.pdf"
    },
    "97": {
        titleEn: "Works of art, collectors' pieces and antiques.",
        titleId: "Karya Seni, Barang Koleksi dan Barang Antik",
        pdfUrl: "https://repository.beacukai.go.id/download/2022/03/af3d932f52d4ef9e184e79dc54d817db-chapter-97.pdf"
    }
};

// Buat peta Chapter -> Section
const CHAPTER_TO_SECTION = {};
SECTIONS.forEach(sec => {
    sec.chapters.forEach(ch => {
        CHAPTER_TO_SECTION[ch] = {
            roman: sec.roman,
            nameId: sec.nameId,
            nameEn: sec.nameEn,
            formatted: `BAGIAN ${sec.roman}: ${sec.nameId}`
        };
    });
});

function updateDatabase() {
    console.log('===============================================================');
    console.log('  PEMBARUAN BASIS DATA HS CODE DARI BEACUKAI.GO.ID/BTKI-DAN-TARIF');
    console.log('===============================================================\n');

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // 1. Pastikan kolom-kolom baru tersedia pada tabel hscode
    const tableInfo = db.prepare('PRAGMA table_info(hscode)').all();
    const existingCols = new Set(tableInfo.map(c => c.name));

    const addColumnIfNotExists = (colName, colType) => {
        if (!existingCols.has(colName)) {
            console.log(`[SCHEMA] Menambahkan kolom: ${colName} (${colType})`);
            db.exec(`ALTER TABLE hscode ADD COLUMN ${colName} ${colType}`);
            existingCols.add(colName);
        }
    };

    addColumnIfNotExists('chapter_title_en', 'TEXT');
    addColumnIfNotExists('pdf_url', 'TEXT');
    addColumnIfNotExists('source_url', 'TEXT');

    // 2. Update metadata seluruh record berdasarkan Chapter Bea Cukai
    console.log('[UPDATE] Memperbarui relasi Section, Judul Bab, dan Tautan PDF Resmi DJBC...');
    
    const updateChapterStmt = db.prepare(`
        UPDATE hscode
        SET section = ?,
            chapter_title_id = ?,
            chapter_title_en = ?,
            pdf_url = ?,
            source_url = ?
        WHERE chapter = ?
    `);

    const updateLevel2Stmt = db.prepare(`
        UPDATE hscode
        SET description_id = ?,
            description_en = ?
        WHERE code = ? AND code_level = 2
    `);

    const runUpdates = db.transaction(() => {
        let count = 0;
        for (const [ch, info] of Object.entries(CHAPTER_DATA)) {
            const sec = CHAPTER_TO_SECTION[ch];
            const secString = sec ? sec.formatted : null;
            const sourceUrl = 'https://www.beacukai.go.id/btki-dan-tarif#';

            const res = updateChapterStmt.run(
                secString,
                info.titleId,
                info.titleEn,
                info.pdfUrl,
                sourceUrl,
                ch
            );
            count += res.changes;

            // Pastikan baris Chapter (2-digit) memiliki description_id dan description_en resmi
            updateLevel2Stmt.run(info.titleId, info.titleEn, ch);
        }
        return count;
    });

    const updatedRows = runUpdates();
    console.log(`[OK] Berhasil memperbarui ${updatedRows} pos tarif dengan metadata resmi DJBC!`);

    // 3. Tambahkan / perbarui pos tarif 8 digit dari dataset referensi nasional
    // Import pos tarif 8-digit dari BTKI_DATABASE di hscode.js
    console.log('[SEED] Mengintegrasikan pos tarif 8-digit BTKI nasional...');
    try {
        const hscodeJsPath = path.join(__dirname, '..', 'hscode.js');
        if (fs.existsSync(hscodeJsPath)) {
            const content = fs.readFileSync(hscodeJsPath, 'utf8');
            const match = content.match(/const\s+BTKI_DATABASE\s*=\s*(\[[\s\S]*?\]);/);
            if (match && match[1]) {
                const btkiItems = eval(match[1]);
                console.log(`[SEED] Ditemukan ${btkiItems.length} pos tarif 8-digit BTKI dengan tarif & Lartas lengkap.`);

                const insert8Stmt = db.prepare(`
                    INSERT INTO hscode (
                        code, code_formatted, code_level, parent_code, section, chapter,
                        chapter_title_id, chapter_title_en, description_en, description_id,
                        bm_mfn, ppn, pph_api, pph_nonapi, lartas, pdf_url, source_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(code) DO UPDATE SET
                        code_formatted = excluded.code_formatted,
                        section = excluded.section,
                        chapter_title_id = excluded.chapter_title_id,
                        chapter_title_en = excluded.chapter_title_en,
                        description_en = excluded.description_en,
                        description_id = excluded.description_id,
                        bm_mfn = excluded.bm_mfn,
                        ppn = excluded.ppn,
                        pph_api = excluded.pph_api,
                        pph_nonapi = excluded.pph_nonapi,
                        lartas = excluded.lartas,
                        pdf_url = excluded.pdf_url,
                        source_url = excluded.source_url
                `);

                const insertTx = db.transaction((items) => {
                    let insCount = 0;
                    for (const item of items) {
                        const rawCode = String(item.hsCode || '').replace(/\D/g, '');
                        if (rawCode.length < 8) continue;
                        const code8 = rawCode.substring(0, 8);
                        const ch = code8.substring(0, 2);
                        const parent = code8.substring(0, 6);
                        const chInfo = CHAPTER_DATA[ch] || {};
                        const sec = CHAPTER_TO_SECTION[ch];

                        let bmVal = 0;
                        if (typeof item.bmMfn === 'number') bmVal = item.bmMfn;
                        else if (typeof item.bmMfn === 'string') {
                            const pMatch = item.bmMfn.match(/(\d+(?:\.\d+)?)\s*%/);
                            if (pMatch) bmVal = parseFloat(pMatch[1]);
                        }

                        insert8Stmt.run(
                            code8,
                            item.formattedCode || item.hsCode,
                            8,
                            parent,
                            sec ? sec.formatted : null,
                            ch,
                            chInfo.titleId || item.babTitle || '',
                            chInfo.titleEn || '',
                            item.uraianEn || '',
                            item.uraianId || '',
                            bmVal,
                            item.ppn ?? 11,
                            item.pphApi ?? 2.5,
                            item.pphNonApi ?? 7.5,
                            item.lartasImpor ? 1 : 0,
                            chInfo.pdfUrl || null,
                            'https://www.beacukai.go.id/btki-dan-tarif#'
                        );
                        insCount++;
                    }
                    return insCount;
                });

                const count8 = insertTx(btkiItems);
                console.log(`[OK] Berhasil memperkaya ${count8} pos tarif 8-digit resmi!`);
            }
        }
    } catch (err) {
        console.warn('[WARN] Gagal menyematkan pos tarif 8-digit:', err.message);
    }

    // 4. Rebuild FTS Index agar pencarian instan dan responsif
    console.log('[FTS] Menyegarkan indeks Full-Text Search (FTS5)...');
    try {
        db.exec(`
            INSERT INTO hscode_fts(hscode_fts) VALUES('rebuild');
        `);
        console.log('[OK] Indeks FTS5 berhasil diperbarui.');
    } catch (err) {
        console.warn('[WARN] Gagal rebuild FTS5 otomatis:', err.message);
    }

    // 5. Cetak statistik akhir
    const total = db.prepare('SELECT COUNT(*) as total FROM hscode').get();
    const withSec = db.prepare('SELECT COUNT(*) as total FROM hscode WHERE section IS NOT NULL').get();
    const withPdf = db.prepare('SELECT COUNT(*) as total FROM hscode WHERE pdf_url IS NOT NULL').get();
    const levels = db.prepare('SELECT code_level, COUNT(*) as total FROM hscode GROUP BY code_level ORDER BY code_level ASC').all();

    console.log('\n===============================================================');
    console.log('  STATISTIK AKHIR DATABASE BTKI (BEACUKAI.GO.ID)');
    console.log('===============================================================');
    console.log(`Total Pos Tarif         : ${total.total}`);
    console.log(`Terpetakan ke Bagian/Sec: ${withSec.total} (${Math.round(withSec.total / total.total * 100)}%)`);
    console.log(`Tautan PDF Resmi DJBC   : ${withPdf.total} (${Math.round(withPdf.total / total.total * 100)}%)`);
    levels.forEach(l => {
        const desc = {
            2: 'Chapter / Bab (2-digit)',
            4: 'Heading / Pos (4-digit)',
            6: 'Subheading / Subpos (6-digit)',
            8: 'Tariff Line / Pos Tarif Nasional (8-digit)'
        }[l.code_level] || `${l.code_level}-digit`;
        console.log(`  - Level ${l.code_level} (${desc}): ${l.total}`);
    });
    console.log('Sumber Resmi: https://www.beacukai.go.id/btki-dan-tarif#');
    console.log('===============================================================\n');

    db.close();
}

if (require.main === module) {
    updateDatabase();
}

module.exports = {
    SECTIONS,
    CHAPTER_DATA,
    CHAPTER_TO_SECTION,
    updateDatabase
};
