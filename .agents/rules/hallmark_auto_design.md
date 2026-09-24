---
trigger: model_decision
description: Gunakan aturan ini secara otomatis ketika mendesain, membuat, merombak (redesign), menata tampilan (styling), atau memperbaiki antarmuka web, HTML/CSS, dashboard, dan komponen frontend.
---

# Hallmark Autonomous Design Rule

Aturan ini menginstruksikan AI untuk secara proaktif dan otomatis menerapkan prinsip **Hallmark** saat bekerja dengan UI/frontend:

## 1. Aktivasi Otomatis (Autonomous Activation)
- Kapan pun ada permintaan yang melibatkan pembuatan UI baru, styling halaman web, pembuatan dashboard, atau perbaikan tampilan frontend, AI harus **otomatis mengaktifkan dan membaca skill Hallmark** (`.agents/skills/hallmark/SKILL.md`) sesuai pertimbangan AI, tanpa perlu menunggu pengguna menyebut kata "hallmark".

## 2. Standar Desain Anti-AI-Slop
- **Hindari Template Generik:** Jangan menggunakan pola generik AI yang membosankan (misalnya warna gradien ungu-biru klise, kartu melayang tanpa hirarki jelas, atau layout 3 kolom monoton).
- **Variasi Struktural:** Setiap halaman atau komponen harus memiliki ritme visual, tipografi berkarakter, dan token warna yang jelas (semantic design tokens).
- **Disiplin Desain Hallmark:**
  - Lakukan self-critique sebelum menghasilkan kode UI.
  - Gunakan token warna & font yang terdefinisi konsisten (bukan inline hex/rgb acak).
  - Pastikan responsivitas mobile (bebas overflow horizontal, touch targets nyaman).
  - Jangan mengarang data/angka bukti palsu jika tidak disediakan pengguna.
