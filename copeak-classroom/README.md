# Copeak Classroom MVP

Copeakのデザイン言語を継承した、音読課題・提出状況・成績管理プラットフォームのMVPです。

## 今できること
- Student / Teacher サインアップ・サインイン（Supabase Auth）
- 先生：学校＋最初のクラス作成、Class Code自動発行
- 生徒：Class Codeでクラス参加
- 先生：CNN Reading 30件を週1回スケジュールで一括登録
- 生徒：30週ロードマップ、締切、提出状況、Accuracy/WPM/Comp.表示
- 先生：Student × Assignmentの成績表、提出率・平均Accuracy表示
- Start Copeakボタンで現行Copeakを開く
- Supabase未接続でもStudent / Teacher Demoを利用可能

## 重要：現在のMVPでまだ自動化していない部分
Copeak本体が採点後に `submissions` へ自動送信する「橋渡し」は次の工程です。
DBとDashboard側の受け皿はすでに用意してあります。

## Supabase接続（最短）
1. Supabaseで新規Projectを作成
2. SQL Editorで `supabase/schema.sql` を全文実行
3. Project Settings / API から Project URL と anon public key を取得
4. `js/config.js` を編集

```js
window.COPEAK_CONFIG = {
  supabaseUrl: 'https://xxxxx.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  copeakBaseUrl: 'https://copeak.pic-speak-story.com/'
};
```

5. Supabase Authentication > Providers > Email を有効化
6. ローカルなら `python -m http.server 8080` で起動し `http://localhost:8080` を開く

## 最初の動作確認
1. Teacherでアカウント作成
2. 学校名＋クラス名を作成
3. CNN 30をロード
4. Class Codeをコピー
5. 別ブラウザ/プライベートウィンドウでStudentアカウント作成
6. Class Codeで参加
7. Student Dashboardに30課題が見えれば成功

## CNNタイトル
News 1–20は既存のCNN Workbook 2026のタイトルを登録済みです。
21–30は現時点では `CNN Reading 21`〜`30` の仮タイトルです。実際の残り10課題名に差し替え可能です。

## 次の工程：Copeak連携
最終的にはCopeak採点完了時に以下を `submissions` にINSERTします。
- assignment_id
- student_id
- accuracy
- wpm
- comprehension
- attempt_no
- submitted_at

セキュリティ上、別ドメインのCopeakへ生徒IDをURLで直接渡す方式は避け、次工程では短時間有効の提出トークン/Edge Function方式にします。
