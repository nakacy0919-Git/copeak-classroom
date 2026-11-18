# Copeak / Copeak Classroom — 最終GO / NO-GO判定票

**対象：** Self-Introduction 正式公開
**点検日：** 2026-11-19 JST
**判定：** **HOLD — 限定本番リリース開始前にバックアップ・復旧条件の確認が必要**

## 確認済み（完了）
- [x] GitHub Classroom PR #5 — Draft、競合なし。最新のCI Run #79 成功
- [x] GitHub Copeak PR #67 — Draft、競合なし。private receiver と iPad original-audio のCI成功
- [x] 本番Supabaseの読み取り専用事前確認：13/13 合格
- [x] PostgreSQL 17 の隔離DBで移行SQLとRLS（所有者・対象課題・公開状態）検証済み
- [x] 両アプリのproductionドメインと現在のREADY本番版を確認
- [x] 自動デプロイは引き続き無効。未承認の本番変更なし
- [x] リリースと非破壊ロールバックの順番を `PRODUCTION_RELEASE_RUNBOOK.md` に記録

## 実施前の必須確認（未完了）

- [ ] **本番Supabaseの復元可能なバックアップ**を本人がダッシュボードで確認する
  - Supabase Dashboard → プロジェクト `copeak-classroom` → Database → Backups
  - 最終バックアップ日時、復旧可能期間、復元先・手順を確認
  - Freeプラン等で管理画面のバックアップが利用できなければ、正式なオフサイト `supabase db dump` / `pg_dump` を安全に取得し、復元可能性を確認
  - DBの復元にはダウンタイムとデータ巻戻しの可能性があるので、デプロイ前のバックアップ確認を省略しない
  - バックアップファイル・DBの秘密鍵・DBパスワードをGitHubやチャットに貼らない
- [ ] **Vercelのロールバック対象をダッシュボードで確認する**
  - 現在のCopeak production: `dpl_2TSSwoWPv7iMfVREetwhDps9JbxJ`
  - 現在のClassroom production: `dpl_FsTHKKhMbRuURo7JL8CZG9HsQQtr`
  - いずれもREADYかつ過去の本番版が複数存在することは確認済み
  - ただし `rollbackCandidate=true` API照会が403で失敗したため、ボタン/権限/対象版は未確認
- [ ] 本番への変更実行許可（Copeakデプロイ、Supabase移行、Classroomデプロイ）を明確に取得

## 本番限定公開後、一般生徒への利用開始前の必須検証

- [ ] ダミーの教員アカウント + 生徒A・Bを使う（実在生徒の氏名や回答は使わない）
- [ ] Teacher: Self-Introduction課題の作成・保存・更新と配布を確認
- [ ] A: Beginner / Intermediate / Advancedで入力→プレビュー→保存→再編集
- [ ] B: Aの下書きを閲覧・変更できないことをDB/RLSと画面の双方で確認
- [ ] クロスポスト配布、公開/未公開、締切前後のアクセス条件を確認
- [ ] Classroom → Copeak: 個人英文がURLに含まれず、音読画面には正しく表示されること
- [ ] Read / Paced / Vanish / Shadowの従来教材が壊れていないこと
- [ ] WPM・Accuracyが正しい生徒と課題にDirect Syncされること
- [ ] 生徒Aがログアウトすると個人用Copeak画面が終了し、BにAの英文が残らないこと
- [ ] Safari / iPad、Chrome / PC、可能ならEdgeで同じ操作を確認
- [ ] 既存Text・Dialogue課題、クラス配布、通常の成績表が正常であること

## 実際の切替順序（無断実行禁止）

1. バックアップと切戻し条件を検証し、承認を取得
2. Copeak本体の受信側を本番反映 → 旧Text/Dialogueのスモークテスト
3. Supabase本番に正式マイグレーション `20261118211500_self_introduction_drafts.sql` を1回適用
4. 変更履歴を確認し、`production-postflight-readonly.sql` の14条件がすべてtrueであることを確認
5. Copeak Classroomの送信・生徒フォーム側を本番反映
6. ダミーユーザーで限定スモークテスト → すべて合格後に一般授業で利用可能と判断

## 切戻しの原則

- Classroom側で問題：Classroomの旧本番版に戻す。新規テーブルは消去しない
- Copeak側で問題：Copeakの旧本番版へ戻す。Classroom新機能の公開を停止
- DB側で問題：権限をPUBLIC/anonに緩めず、対象の新機能を停止。復元は事前に確認したバックアップ手順に従って慎重に行う
- GitHub Draft PRを自動マージしない。VercelのGit自動デプロイは無効のまま維持

## 関連リンク
- Classroom: https://github.com/nakacy0919-Git/copeak-classroom/pull/5
- Copeak: https://github.com/nakacy0919-Git/copeak/pull/67
- 詳細版: `ops/self-introduction/PRODUCTION_RELEASE_RUNBOOK.md`

**公開判定ルール：** バックアップ・切戻し確認と明示的な本番反映承認がそろえば「限定切替開始の準備完了」。限定スモークテストを通過して初めて「一般生徒へ公開可能」。
