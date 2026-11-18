# Copeak Classroom Self-Introduction — 本番リリース手順（準備版）

**作成日:** 2026-11-19  
**状態:** 本番DBの読み取り専用事前点検とGitHub実CIに合格。**本番移行SQLは未適用・Vercelデプロイも未実施。**  
**対象の本番Supabase:** `copeak-classroom`（project ref: `sxcbudhcxiblpdzpgfep`）

## 1. 変更範囲

- 本番DB `public.assignments` の教材タイプに `self_intro` を追加（既存 `text` / `dialogue` は維持）
- `public.assignments.lesson_template jsonb` 追加。公開済みSelf-Introductionはレベル・入力項目・表現設定を必須にする
- 生徒本人だけが閲覧・保存・更新できる `public.student_intro_drafts` 追加
- 生徒IDと課題IDを変更できない保存トリガー、サーバーで更新する `updated_at`、競合防止
- **新しいテーブルに匿名ユーザー権限を付与しない。** 教師も生徒の自己紹介回答を直接参照できるRLSポリシーは追加しない
- Copeak本体には、URLを使わない個別英文通信と共用端末のメモリ保護を先に導入する

## 2. 事前の安全点検（読み取り専用で実施済み）

実行済み: `ops/self-introduction/production-preflight-readonly.sql` の13条件すべて `true`（2026-11-19）。

追加で、Supabaseの `list_migrations` に `20261118211500` の適用履歴がないことを確認済み。

**リリース直前に再実行すること**。13条件のどれかが `false` になった場合は中断し、DBの差分を再調査する。

## 3. リリース前の必須ゲート

1. **GitHub実CIは合格済み（2026-11-19）**。ClassroomのNode/既存教材/分離PostgreSQL RLSテスト：run 44403129714 SUCCESS。Copeakのプライベート受信テスト：run 44402806643 SUCCESS、iPad音声回帰：run 44402806537 SUCCESS。該当コードを変更したら必ず再実行する。
2. マイグレーション `supabase/migrations/20261118211500_self_introduction_drafts.sql` をレビューする。最新版にはテンプレート妥当性と保存主キーの変更禁止が含まれる。
3. Supabase本番プロジェクトの**復旧可能なバックアップ**とPITR/復元方法を管理画面で確認。バックアップ未確認なら移行しない。ダンプを取得する場合は暗号化された管理端末で扱い、GitHubやチャットに貼らない。
4. 先生・生徒の実在アカウントのデータをSQLテスト用に流用しない。実運用検証には専用のダミーアカウントと未公開の課題を用意する。
5. 学校の授業時間外に実施し、DBのDDLとフロントエンド公開を別作業として記録する。
6. セキュリティアドバイザーに既存の匿名実行可能 `SECURITY DEFINER` 関数警告があるため、別の監査案件として扱う。今回のマイグレーションで既存RPCのEXECUTE権限を一括変更しない。

## 4. 本番反映順序（**このドキュメントの作成時点では未実行**）

**A — Copeak本体を先に公開（明示的な本番反映許可が必要）**

- 出典ブランチ: `nakacy0919-Git/copeak` の `qa/private-intro-pre-release-stage6-20261119`
- 新しい受信機能は旧ClassroomのText・Dialogue起動に影響しない
- 公開後、現在のText・Dialogue音読、ライブラリー、成績送信が変わっていないか確認

**B — 本番Supabaseに移行SQLを適用（**必ず別承認**）**

- 単一の正式マイグレーションとして `20261118211500_self_introduction_drafts` を実行し履歴に記録
- SQLファイルを単に手動コピーして実行しただけではマイグレーション履歴にならないため、実行方法を統一する
- 本番移行前のスナップショットを確認済みであること
- 実行後すぐに `ops/self-introduction/production-postflight-readonly.sql` を読み取り専用で実行し、すべて `true` になることを確認
- `list_migrations` に該当バージョンの記録が追加されたことを確認

**C — Classroomの送信側を最後に公開（明示的な許可が必要）**

- 出典ブランチ: `release/self-intro-production-preflight-20261119`
- 教師用Self-Introduction編集画面を含む
- Copeak本体の受信機能と本番DBスキーマが先に利用可能になってから実施

**D — 本番の限定動作確認**

- 生徒A/Bのダミーアカウント（実生徒の個人情報を使わない）
- 先生が未公開課題を作り、限定公開で入力・保存・再編集・ブラウザ更新・音読・Accuracy/WPM提出を確認
- タブ競合時に上書き選択が出ること、他人の保存内容を参照できないこと、締切後の練習不可・再編集可、ログアウト時の個人用Copeakタブ終了を確認
- iPad/Safari、PC/Chrome/Edgeで再現
- Text/Dialogueとクラス跨ぎ配布の回帰を確認し、問題があれば一般生徒には公開しない

## 5. 障害発生時の復旧

- **SQL適用前に異常:** 実行中止。両サイトは現状維持
- **Copeak本体公開で異常:** Copeakの直前の安定版へ戻し、Classroomの公開を行わない
- **SQL適用後かつClassroom未公開:** Classroomの旧版を維持する。新しいテーブルと列は既存Text/Dialogueと互換性があり、無理に削除しない
- **Classroom公開後に異常:** Classroomを旧版に戻す。新しい保存テーブルを削除しない。既存の生徒下書きを保持し、原因修正後に再公開する
- **RLSや権限に異常:** 新機能の公開を停止し、RLS設定を調査。ロールを `PUBLIC`/ `anon` に緩めて応急処置しない
- **DBの不可逆的破損:** 事前に確認したバックアップ/PITR復旧手順へ移行。データを失う `DROP TABLE` や `DELETE` によるロールバックをしない

## 6. 公開可否の判定

本番DBの事前条件13/13と GitHub実CI（Node＋分離PostgreSQLのRLS確認）は **PASS**。しかし公開可否は **HOLD**（本番DB移行未実施、バックアップ復旧の確認未完了、iPad/Safari実機と生徒2人の限定動作確認が未完了）。

今回の作業はあくまで**本番適用に向けたコードと手順の準備**であり、デプロイ・DB移行・mainマージは含まない。

## 7. 関連ファイル

- `supabase/migrations/20261118211500_self_introduction_drafts.sql` — 本番用候補マイグレーション
- `ops/self-introduction/production-preflight-readonly.sql` — 適用前13条件
- `ops/self-introduction/production-postflight-readonly.sql` — 適用後14条件
- `tests/sql/self-introduction-fixture.sql` / `tests/sql/self-introduction-verify.sql` — PostgreSQLの分離検証
- `tests/self-introduction-migration-qa.test.cjs` — SQLの構造・権限回帰テスト
- `docs/self-introduction-stage6-qa-report.md` — 第6段階品質チェック

**Vercel:** 両方のリポジトリの `vercel.json` の `git.deploymentEnabled=false` を維持する。

## 8. GitHubレビュー用PR（未マージ）

- Classroom Draft PR: https://github.com/nakacy0919-Git/copeak-classroom/pull/5
- Copeak Draft PR: https://github.com/nakacy0919-Git/copeak/pull/67
- **Draft PRは承認前にマージしない。** GitHub Actionsの実行はVercelデプロイとは別であり、Vercelへの自動反映は無効のまま。
