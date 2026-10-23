# 🌱 習慣養成

記錄每天的習慣、累積分數、設定目標、兌換獎勵。手機和電腦會自動同步。

網址：https://seanchang-3245.github.io/habit-tracker/

## 功能

- **今天**：每個習慣按 ＋／− 記錄次數，馬上看到今日得分；可以切換到過去的日期補記
- **習慣**：自訂名稱、圖示、每次得幾分（至少 1 分）、單位、每日目標；可以排序、封存
- **目標**：四種類型（累積分數、完成次數、達標天數、連續達標），可以設定獎勵和額外加分
- **獎勵**：用累積的分數兌換自己設定的獎勵，有兌換紀錄，也可以撤銷
- **統計**：本週、本月、累積得分，每日得分熱力圖，每個習慣的連續天數
- **同步與離線**：沒網路也能記錄，恢復連線後自動上傳

## 技術

- React + TypeScript + Vite + Tailwind CSS，做成 PWA（可以加到手機主畫面）
- Supabase（資料庫與登入），每個使用者只能存取自己的資料（Row Level Security）
- GitHub Actions 自動部署到 GitHub Pages

## 一次性設定

1. **建立資料表**：Supabase 後台 → SQL Editor → 貼上 `supabase/schema.sql` 的全部內容 → Run
2. **登入設定**：Supabase 後台 → Authentication
   - Sign In / Providers → Email → 關閉「Confirm email」（自己用，不需要收驗證信）
   - URL Configuration → Site URL 填 `https://seanchang-3245.github.io/habit-tracker/`
3. **開啟 GitHub Pages**：GitHub repo → Settings → Pages → Source 選「GitHub Actions」
4. 在 App 註冊帳號以後，回到 Supabase → Authentication → Sign In / Providers，關閉「Allow new users to sign up」，別人就不能註冊

## 在手機上安裝

- iPhone：用 Safari 打開網址 → 分享 → 加入主畫面
- Android：用 Chrome 打開網址 → 選單 → 安裝應用程式／加到主畫面

## 本機開發

```bash
npm install
npm run dev
```
