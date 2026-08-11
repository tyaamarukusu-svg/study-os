# Study OS 3問音声テスト

既存のブラウザ読み上げは残したまま、短い・標準・長い3問だけをOpenAI Speech APIでMP3化して確認するためのテストです。

## 対象

- 短い: `unko-1020`
- 標準: `unko-6015`
- 長い: `unko-5020`

問題音声と正解・解説音声を分け、ブラウザ側で4秒待ってから正解を再生します。

## 生成方法

APIキーはファイルへ書かず、環境変数 `OPENAI_API_KEY` に設定します。

```sh
python3 scripts/generate_tts_test.py
```

既定値は高品質寄りの `tts-1-hd`、音声は `alloy` です。変更する場合は `OPENAI_TTS_MODEL` と `OPENAI_TTS_VOICE` を環境変数で指定します。

## 試聴方法

プロジェクト直下でローカルサーバーを起動し、`audio-test.html`を開きます。

```sh
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/audio-test.html` を開いてください。

## 全件生成前の確認

- 日本語の自然さ
- 法律用語・数字の読み方
- 声質
- 読み上げ速度
- 問題と正解の間（現在4秒）
- 長い解説の聞きやすさ

3問を確認するまで220問の一括生成は行いません。
