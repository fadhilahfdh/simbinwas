-- ============================================================
-- SKEMA DATABASE SIMBINWAS (INSPEKTORAT KABUPATEN SERANG)
-- Engine: PostgreSQL
-- ============================================================

-- 1. ENUMERASI (ENUM TYPES)
CREATE TYPE enum_jabatan_fungsional AS ENUM ('AUDITOR', 'PPUPD', 'STRUKTURAL', 'PELAKSANA');
CREATE TYPE enum_role_pengawasan AS ENUM ('INSPEKTUR', 'IRBAN', 'DALNIS_SUPERVISOR', 'KATIM', 'ANGGOTA');
CREATE TYPE enum_kategori_obrik AS ENUM ('DINAS', 'BADAN', 'KECAMATAN', 'PUSKESMAS', 'DESA', 'RSUD', 'BAGIAN');
CREATE TYPE enum_status_st AS ENUM ('DRAFT', 'REVIEW_DALNIS', 'APPROVED_IRBAN', 'TTE_TERBIT');
CREATE TYPE enum_status_kkp AS ENUM ('DRAFT_KATIM', 'REVIEW_DALNIS', 'REVIEW_IRBAN', 'ACC_FINAL');
CREATE TYPE enum_status_tlhp AS ENUM ('TS', 'TB', 'BT', 'TDT');

-- 2. TABEL USERS (PEGAWAI APIP & PENGGUNA)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(18) UNIQUE NOT NULL,
    nama VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    jabatan_fungsional enum_jabatan_fungsional DEFAULT 'AUDITOR',
    jenjang_jabatan VARCHAR(50) DEFAULT 'Ahli Muda',
    role enum_role_pengawasan NOT NULL,
    irban_wilayah VARCHAR(50), -- Contoh: 'Irban Khusus', 'Irban Wilayah I'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL OBRIK (ORGANISASI / SKPD TARGET PENGAWASAN)
CREATE TABLE obrik (
    id SERIAL PRIMARY KEY,
    nama_obrik VARCHAR(200) NOT NULL,
    kategori enum_kategori_obrik NOT NULL,
    alamat TEXT,
    pimpinan_nama VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL PKPT_PLANS (PERENCANAAN PKPT TAHUNAN)
CREATE TABLE pkpt_plans (
    id SERIAL PRIMARY KEY,
    tahun_anggaran INT NOT NULL DEFAULT 2026,
    obrik_id INT REFERENCES obrik(id) ON DELETE CASCADE,
    irban_penanggung_jawab VARCHAR(50) NOT NULL,
    jenis_pengawasan VARCHAR(100) NOT NULL,
    bulan_rencana INT CHECK (bulan_rencana BETWEEN 1 AND 12),
    alokasi_hp INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABEL SURAT_TUGAS (PENUGASAN APIP)
CREATE TABLE surat_tugas (
    id SERIAL PRIMARY KEY,
    no_st VARCHAR(100) UNIQUE,
    pkpt_id INT REFERENCES pkpt_plans(id) ON DELETE SET NULL,
    obrik_id INT REFERENCES obrik(id) ON DELETE CASCADE,
    tgl_mulai DATE NOT NULL,
    tgl_selesai DATE NOT NULL,
    alokasi_hp INT NOT NULL,
    status_st enum_status_st DEFAULT 'DRAFT',
    file_st_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABEL ST_PERSONEL (PIVOT SUSUNAN TIM PER SURAT TUGAS)
CREATE TABLE st_personel (
    id SERIAL PRIMARY KEY,
    st_id INT REFERENCES surat_tugas(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    peran_dalam_tim enum_role_pengawasan NOT NULL,
    UNIQUE(st_id, user_id)
);

-- 7. TABEL KKP_FILES (KOMPILASI KKP FINAL & MATRIKS REVIU)
CREATE TABLE kkp_files (
    id SERIAL PRIMARY KEY,
    st_id INT REFERENCES surat_tugas(id) ON DELETE CASCADE,
    katim_id INT REFERENCES users(id),
    versi_file VARCHAR(20) DEFAULT 'v1',
    file_path VARCHAR(255) NOT NULL,
    status_kkp enum_status_kkp DEFAULT 'DRAFT_KATIM',
    catatan_reviu_dalnis TEXT,
    catatan_reviu_irban TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABEL TLHP_FINDINGS (REKOMENDASI LHP & EWS)
CREATE TABLE tlhp_findings (
    id SERIAL PRIMARY KEY,
    st_id INT REFERENCES surat_tugas(id) ON DELETE CASCADE,
    obrik_id INT REFERENCES obrik(id) ON DELETE CASCADE,
    no_lhp VARCHAR(100) NOT NULL,
    tgl_lhp DATE NOT NULL,
    tgl_jatuh_tempo_60hari DATE NOT NULL,
    uraian_temuan TEXT NOT NULL,
    uraian_rekomendasi TEXT NOT NULL,
    nilai_rekomendasi_rp NUMERIC(15,2) DEFAULT 0.00,
    status_tlhp enum_status_tlhp DEFAULT 'BT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABEL TLHP_EVIDENCES (BUKTI SETOR / BAST TLHP)
CREATE TABLE tlhp_evidences (
    id SERIAL PRIMARY KEY,
    finding_id INT REFERENCES tlhp_findings(id) ON DELETE CASCADE,
    no_ntpn_sts VARCHAR(100) NOT NULL,
    nilai_setor_rp NUMERIC(15,2) NOT NULL,
    file_bukti_path VARCHAR(255) NOT NULL,
    verified_by INT REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED DATA AWAL (DEMO USERS & OBRIK)
-- ============================================================
INSERT INTO users (nip, nama, password_hash, email, jabatan_fungsional, jenjang_jabatan, role, irban_wilayah) VALUES
('199512222026011001', 'Fadhilah Dwi Harso, S.ST', 'hash_password_demo', 'fadhil@serangkab.go.id', 'PPUPD', 'Ahli Muda', 'IRBAN', 'Irban Khusus'),
('198503152010011002', 'Rahmat Hidayat, M.Si', 'hash_password_demo', 'rahmat@serangkab.go.id', 'AUDITOR', 'Ahli Madya', 'DALNIS_SUPERVISOR', 'Irban Khusus'),
('199007202015021003', 'Dewi Lestari, S.E.', 'hash_password_demo', 'dewi@serangkab.go.id', 'AUDITOR', 'Ahli Muda', 'KATIM', 'Irban Khusus');

INSERT INTO obrik (nama_obrik, kategori, alamat, pimpinan_nama) VALUES
('RSUD Kabupaten Serang', 'RSUD', 'Jl. Rumah Sakit No. 1 Serang', 'dr. H. Rahmat, M.Kes'),
('Dinas Pekerjaan Umum dan Penataan Ruang', 'DINAS', 'Kawasan Pusat Pemerintahan Kabupaten Serang', 'Ir. H. Ahmad, M.T.'),
('Bappeda Kabupaten Serang', 'BADAN', 'Jl. Veteran No. 3 Serang', 'Drs. H. Wahyu, M.Si');