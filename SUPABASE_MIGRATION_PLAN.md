# Supabase移行 調査・計画メモ

作成日: 2026-06-20
対象: 工具・備品 入出庫・所在管理Webアプリ

このドキュメントは、Supabaseによるデータ共有・ログイン機能・admin/employee権限制御・
氏名自動記録を段階的に導入するための、現状調査結果と移行計画をまとめたものです。
**この調査時点では実装は行っていません。** 第2段階の着手前に内容を確認してください。

---

## 1. 現在の構成

### 主要ファイル一覧

| 領域 | ファイル |
|---|---|
| ルーティング | `src/App.tsx`(`BrowserRouter` + フラットな `Routes` 一覧。認証ガード等は無し) |
| 型定義 | `src/types/index.ts`(Category / Location / Item / Movement / 各種WithRelations) |
| データアクセス層 | `src/repository/types.ts`(`DataRepository` インターフェース)、`src/repository/localStorageRepository.ts`(実装本体)、`src/repository/selectors.ts`(結合・検索用ヘルパー) |
| 初期データ | `src/data/seedData.ts` |
| ユーティリティ | `src/utils/id.ts`(独自形式のID生成。UUIDではない)、`src/utils/date.ts`、`src/utils/csv.ts` |
| 画面 | `src/pages/*.tsx`(14画面+設定+404) |
| 共通コンポーネント | `src/components/*.tsx`(Header, MovementForm, ItemCard, MovementCard, StatusBadge, MovementBadge, ErrorBoundary, EmptyState, BottomActions) |

### データ保存方法

ブラウザのlocalStorageに、`item-tracker-{items|locations|categories|movements}-v1` の
4キーでJSON配列として保存。Supabase・認証関連のコード、`.env`等の環境変数、SQLファイルは
**一切存在しません**(過去に作成されたものも無し)。

### 画面構成

ホーム / 手入力検索 / QRコード読取 / 物品確認 / 出庫登録 / 入庫登録 / 移動登録 /
登録完了 / 現在地一覧 / 履歴一覧(一覧・日別・月別・現場別) / 現場別確認 / 物品管理 /
場所・現場管理 / QRコード発行 / 設定 / 404。ルートはすべてフラットに `App.tsx` で定義され、
レイアウトルートやロール別の出し分けは存在しません。

### 入出庫処理の場所

`src/components/MovementForm.tsx` が出庫・入庫・移動の共通UIを提供し、
`OutboundPage.tsx` / `InboundPage.tsx` / `TransferPage.tsx` がそれぞれ移動先の
選択肢(置場のみ/現場のみ/現在地以外すべて)を渡して呼び出しています。
実際の保存処理は `localStorageRepository.ts` の `registerMovement()` に一本化されています。

### 履歴処理の場所

`registerMovement()` 内で履歴(movements)への追加と物品(items)の現在地更新を行い、
`selectors.ts` の `getMovementsWithRelations()` が表示用に物品名・場所名を結合します。
履歴の絞り込み・グルーピング(日別/月別/現場別)は `HistoryPage.tsx` 側でクライアント側の
配列処理として行われています。

---

## 2. Supabase移行の難易度

| 項目 | 難易度 | 補足 |
|---|---|---|
| 物品データ移行 | 低 | 型がほぼそのままテーブル定義になる。IDが独自形式の文字列(UUIDではない)なので、そのままTEXT主キーにするか、移行時にUUIDへ振り直すかの判断が必要 |
| 場所・現場データ移行 | 低 | 同上。`startDate`がフォーム入力では日付のみ、シードデータではISO日時という不整合が既にあるため、移行時に型(date/timestamptz)を決め打ちで統一するとよい |
| 履歴データ移行 | 中 | データ自体は単純だが、`registerMovement`の「履歴追加+現在地更新」という2テーブル更新を、Supabase側でどう原子的に行うか(RPC化)の設計が必要 |
| ログイン追加 | 中 | Supabase Authの導入自体は定型的だが、現在ルーティングに認証ガードの仕組みが全く無いため、`App.tsx`の再構成が必要 |
| 権限制御 | 中〜高 | admin/employeeの出し分けは「ルート単位」「ボタン表示単位」「物品の状態に応じた操作可否」の3層に渡る。特に状態(修理中/所在不明/使用停止)に応じた制御は現在のItemDetailPageのロジックを拡張する必要がある |
| 氏名自動記録 | 低〜中 | 仕組み自体は単純(ログイン中アカウント情報をmovementsに書き込むだけ)だが、既存の自由入力の氏名欄をどのタイミングで削除するか、履歴の氏名表示ロジックの調整が必要 |
| RLS | 高 | admin/employeeで読み書き可能な範囲が大きく異なる(履歴の全件閲覧、CSV出力、物品/場所の編集など)ため、ポリシー数が多くなる。特に「物品の状態に応じた更新可否」をRLSだけで表現するか、アプリ側のチェックと併用するかの設計判断が必要 |

---

## 3. 変更が必要なファイル

| ファイル | 現在の役割 | 今後必要な変更 | 段階 |
|---|---|---|---|
| `src/repository/types.ts` | `DataRepository`インターフェース定義 | 全メソッドの返り値を`Promise<T>`化。`registerMovement`の引数に`registeredByUserId`/`registeredByName`を追加 | 1(データアクセス層整理)・3(Supabase化) |
| `src/repository/localStorageRepository.ts` | localStorage実装 | そのまま残す(開発用・オフラインフォールバック用に維持するか、削除するかは要検討) | 3 |
| 新規: `src/repository/supabaseRepository.ts` | (未作成) | `DataRepository`を実装するSupabase版を新設。`registerMovement`はSupabaseのRPC呼び出しにする | 3 |
| 新規: `src/repository/index.ts` | (未作成) | `repository`のexport元を1か所に集約し、各ページのimport先を統一する(現状は13ファイルが`localStorageRepository`を直接import) | 1 |
| `src/repository/selectors.ts` | 結合・検索ヘルパー | 同期処理前提のロジックを非同期化。呼び出し側のuseEffect化に伴いキャッシュ戦略(都度fetchか、簡易なクライアントキャッシュか)を検討 | 1・3 |
| `src/App.tsx` | ルーティング定義 | 認証状態を見るラッパー、ロール別アクセス制御、ログイン画面・アカウント管理画面のルート追加 | 4・6 |
| 新規: `src/contexts/AuthContext.tsx`等 | (未作成) | ログイン中アカウント情報(id/email/display_name/role)をアプリ全体に供給する仕組み | 4・5 |
| `src/types/index.ts` | 型定義 | `Account`/`Profile`型の新設。`Movement`に`registeredByUserId`/`registeredByName`追加。`MovementInput`も同様 | 5・8 |
| `src/components/MovementForm.tsx` | 出庫/入庫/移動の共通フォーム | 氏名入力欄を削除し、ログイン中アカウントの表示名を読み取り専用表示に変更。送信時に`registeredByUserId`/`registeredByName`/`registeredAt`を自動セット | 7・8 |
| `src/pages/ItemDetailPage.tsx` | 物品確認・操作ボタンの出し分け | 現在の「置場かどうか」のみの判定に加え、ロールと物品状態(修理中/所在不明/使用停止)を組み合わせた表示制御に拡張 | 6 |
| `src/pages/TransferPage.tsx` | 移動先選択肢の組み立て | employee向けには移動先を`locationType==='site'`の現場のみに絞る(現在は現在地以外の有効な場所すべて) | 6 |
| `src/pages/HistoryPage.tsx` / `LocationsOverviewPage.tsx` | 全履歴・現在地一覧・CSV出力 | admin限定の画面/操作であることをルートガード側で制御(画面自体の改修は最小限の想定) | 6 |
| `src/pages/ItemManagementPage.tsx` / `LocationManagementPage.tsx` / `SettingsPage.tsx` | 物品/場所管理・設定 | admin限定ルートに変更。`SettingsPage`の「テストデータ初期化」はSupabase化後の扱いを別途検討(本番データを誤って消す事故防止) | 6 |
| 新規: `src/pages/LoginPage.tsx` | (未作成) | ログイン画面 | 4 |
| 新規: `src/pages/AccountManagementPage.tsx` | (未作成) | adminによるアカウント管理画面 | 4以降 |
| `src/components/ErrorBoundary.tsx` | 同期的なレンダーエラーの捕捉 | 非同期処理(Supabase通信)のエラーはReactのError Boundaryでは捕捉できないため、各ページ側でのtry/catch・エラー状態表示を別途整備する必要がある | 3 |
| `src/data/seedData.ts` | localStorage用の初期データ生成 | Supabase化後はSQLのseedスクリプト、またはSupabase管理画面からの投入に置き換え。形式の異なる`startDate`をこの段階で統一しておくと移行が楽になる | 2 |

---

## 4. 推奨する実装順

ご提示いただいた基準を、現在のコード構造に合わせて並べ直すと以下の順になります。

1. **データアクセス層整理**: `repository/index.ts`を新設しimport先を集約。`DataRepository`を
   Promiseベースに変更(まだlocalStorage実装のまま、async/awaitでラップするだけでもよい)。
   各ページをuseEffect+ローディング状態に対応させる。ここが最も影響範囲が広いが、
   Supabase接続より前に独立して進められる。
2. **Supabaseテーブル作成**: categories / locations / items / movements の4テーブル+
   RLS無しでまず作成。型定義(`src/types/index.ts`)とカラムを1対1で対応させる。
3. **物品・場所・履歴のSupabase化**: `supabaseRepository.ts`を実装し、
   `registerMovement`をPostgres関数(RPC)化して履歴追加+現在地更新を原子的に行う。
   この時点ではまだログイン無し(匿名アクセス、RLSもまだ無し)。
4. **ログイン追加**: Supabase Authを導入し、ログイン画面・ログアウトを実装。
   `App.tsx`に認証ガードを追加(まずは「ログインしていればOK」レベル)。
5. **profiles追加**: `id/email/display_name/role/is_active`を持つテーブルを追加し、
   ログイン中アカウント情報をアプリ全体に供給するContextを実装。
6. **admin・employeeのルート制御**: ロールに応じて表示するルート・ボタン・操作を
   出し分ける。物品の状態(修理中/所在不明/使用停止)に応じた制御もここで実装。
7. **氏名入力欄削除**: `MovementForm.tsx`の自由入力欄を削除し、ログイン中アカウントの
   表示名に置き換える。
8. **操作者自動記録**: `registerMovement`の呼び出し時に`registeredByUserId`/
   `registeredByName`/`registeredAt`を自動セットするよう接続する。
9. **RLS**: ここまで動作確認できた段階で、admin/employeeそれぞれの読み書き範囲に
   合わせたRLSポリシーを設定する。RLSを最初から有効にすると開発中の動作確認が
   難しくなるため、機能実装が一通り終わった後に設定するのが安全。
10. **実機確認**: スマホ・タブレットでのログイン状態保持、QRコード読取、
    オフライン時の挙動(Supabase接続失敗時にどう見せるか)を確認。

---

## 5. リスク

- **既存データが消える可能性**: 現在のテストデータはlocalStorageのみに存在し、
  Supabase移行時に手動で移すかシードし直す必要がある。「設定」画面の
  テストデータ初期化ボタンは本番運用開始後は誤操作で本番データを消しうるため、
  Supabase化のタイミングで無効化または管理者限定の強い確認を入れることを推奨。
- **localStorageとSupabaseの二重管理**: 移行を段階的に行う場合、一時的に
  どちらが正のデータソースか曖昧になる期間が発生しうる。リポジトリ実装の
  切り替えは「一括」で行い、中間状態を作らないことを推奨。
- **型の不一致**: `startDate`の日付/日時不一致など、現状でも軽微な不整合がある
  (本調査でコード上にコメントを追加済み)。Supabaseのテーブル定義を作る際に
  これらを精査し、型を確定させる必要がある。
- **履歴欠損**: `registerMovement`は履歴(movements)と物品(items)を別々の
  localStorage書き込みとして行っており、2つ目の書き込みが失敗すると履歴だけが
  残り現在地が更新されない不整合が理論上発生しうる(本調査でコメント済み)。
  Supabase化時はPostgres関数による単一トランザクション化でこの問題自体を解消できる。
- **権限漏れ**: 「修理中・所在不明の物品はemployeeが状態変更不可」のような
  物品状態に応じた制御は、UIでボタンを隠すだけでは不十分(URLを直接叩く・
  devtoolsでAPI呼び出しを再現するなどで回避されうる)。最終的にはRLS側でも
  同じ制約を表現する必要がある。
- **白画面の可能性**: 現在のError Boundaryはレンダー時の同期エラーのみを捕捉する。
  Supabase通信は非同期(Promise)のため、useEffect内の例外やPromiseの拒否は
  Error Boundaryでは捕捉されない。各ページでの個別のtry/catch・エラー表示の
  実装を徹底しないと、データ取得失敗時に「真っ白ではないが何も表示されない」
  状態になるおそれがある。
- **QR機能への影響**: QRコード読取(`QrScanPage.tsx`)・発行(`QrIssuePage.tsx`)は
  カメラ制御・画像デコード・QR生成のロジック自体はSupabaseと無関係で影響を受けない。
  影響があるのは読取後の物品検索1か所(`repository.getItemByManagementNumber`)のみで、
  ここを非同期呼び出しに変更する必要がある程度の小さな変更で済む見込み。

---

## 6. 第2段階で実施すべき内容(着手はまだしない)

次に行う作業のみを提示します。実装はまだ開始していません。

1. `src/repository/index.ts` を新設し、現在13ファイルが直接importしている
   `localStorageRepository` の参照を、この中立的なエントリポイント経由に揃える
   (動作は変えない、importパスのみの整理)。
2. `src/repository/types.ts` の `DataRepository` インターフェースを、
   全メソッド `Promise<T>` を返す形に書き直す(まずは型のみ。実装側は
   `localStorageRepository.ts` を `async`化してそのまま同じ処理を返すだけにする)。
3. 上記の型変更に合わせて、各ページの同期呼び出し(`useMemo`や直接呼び出し)を
   `useEffect`+`useState`によるローディング状態を持つ形に1ページずつ書き換える。
4. Supabaseプロジェクトを作成し、`categories`/`locations`/`items`/`movements`の
   4テーブルをSQLで定義する(RLSはまだ無効のまま)。
5. ここまで完了した時点で一度動作確認を行い、その後の章(ログイン追加以降)に進む。

---

## 最終確認(動作確認ログ)

調査・コメント追加後、以下を実行し既存機能が壊れていないことを確認しました。

```
npm install   → 完了(エラー無し)
npm run build → 完了(tsc型チェック含め成功)
TypeScriptエラー → 0件
```
EOF
