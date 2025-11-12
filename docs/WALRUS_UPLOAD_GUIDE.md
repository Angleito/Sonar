# Walrus Audio Upload Guide (Testnet)

_Last reviewed: 2025-11-11_

This guide explains how to prepare 5+ minute audio assets and upload them to Walrus testnet using the helper script in `scripts/upload-to-walrus.sh`. The script enforces the duration requirement and records blob IDs for later on-chain submissions.

## Prerequisites

### 1. Walrus CLI
```bash
curl -L https://storage.googleapis.com/mysten-walrus-binaries/walrus-testnet-latest-macos-x86_64 -o walrus
chmod +x walrus
sudo mv walrus /usr/local/bin/
walrus --version
```

### 2. Sui CLI (for wallet + faucet)
```bash
sui client
sui client switch --env testnet
sui client faucet
```

### 3. Audio Assets (≥300 seconds)
Produce at least one 5-minute clip per dataset. Example generators using FFmpeg noise sources:
```bash
mkdir -p ~/audio-samples
cd ~/audio-samples
ffmpeg -f lavfi -i anoisesrc=duration=320:color=white:sample_rate=44100 -ac 2 ambient_white.wav
ffmpeg -f lavfi -i anoisesrc=duration=360:color=pink:sample_rate=44100 -ac 2 ambient_pink.wav
ffmpeg -f lavfi -i anoisesrc=duration=420:color=brown:sample_rate=44100 -ac 2 ambient_brown.wav
```

## Upload Workflow

### Step 1 – Run the helper script
```bash
cd /Users/angel/Projects/sonar/scripts
./upload-to-walrus.sh ~/audio-samples/ambient_white.wav
```
What the script does:
- Confirms Walrus CLI exists.
- Uses `ffprobe` (if available) to enforce ≥300 s duration.
- Streams the file to Walrus with `walrus store --network testnet --json`.
- Prints the blob ID and appends `<filename>|<blobId>|<timestamp>` to `walrus-uploads.txt` for bookkeeping.

Sample output:
```
INFO: Uploading ambient_white.wav (52M) to Walrus testnet...
INFO: Duration: 320 seconds ✓
SUCCESS: Uploaded successfully!

Blob ID: Cg4bXHWZD3rmK9QvGPZxp4dMB_SqJUr7kVtF8wN2eL0
File: ambient_white.wav
Size: 52M

INFO: Saved to walrus-uploads.txt
```
Only the encrypted blob ID is returned. Preview blobs are uploaded separately (see Step 3).

### Step 2 – Verify the blob
```bash
export WALRUS_AGGREGATOR=${NEXT_PUBLIC_WALRUS_AGGREGATOR_URL:-https://aggregator.walrus-testnet.walrus.space}
BLOB_ID=Cg4bXHWZD3rmK9QvGPZxp4dMB_SqJUr7kVtF8wN2eL0
curl "$WALRUS_AGGREGATOR/v1/$BLOB_ID" -o verify.wav
ffprobe verify.wav  # should show 5+ minutes, expected mime
```

### Step 3 – Upload a preview (optional but recommended)
Use the edge preview endpoint to host a 30-second teaser:
```bash
# Create a 30-second segment (example)
ffmpeg -i ambient_white.wav -t 30 -acodec copy ambient_white_preview.wav

# POST to the edge function (runs in Next.js dev or production build)
curl -X POST \
  -F "file=@ambient_white_preview.wav" \
  http://localhost:3000/api/edge/walrus/preview
```
Response contains `previewBlobId`; store it alongside the main `blobId` when seeding datasets or submitting on-chain metadata.

### Step 4 – Record metadata
Capture the following fields for each dataset:
- `walrus_blob_id` – from Step 1.
- `preview_blob_id` – from Step 3 (optional but required for hover previews in the UI).
- `duration_seconds`, `mime_type` – keep in sync with what you submit to the Move contract.

## Troubleshooting
- **Walrus CLI missing**: install using the command above.
- **"Audio file must be at least 5 minutes"**: regenerate or extend the clip (`ffmpeg -stream_loop`).
- **`walrus store` returns non-zero**: ensure your Sui wallet has enough storage funds (Walrus uses SUI for storage costs). Re-run `sui client faucet`.
- **Preview upload fails with 400**: file larger than 10 MB. Re-encode with mono or lower sample rate.
- **Aggregator fetch 404**: Walrus testnet occasionally lags; retry after the certification epoch or confirm blob ID spelling.

## Storage Cost (Testnet)
Walrus testnet uses faucet-funded SUI; real costs are not enforced. Expect ~0.05 SUI per 50 MB blob. On mainnet, consult Walrus docs for current pricing.

## References
- Walrus Docs: https://docs.walrus.site
- Mysten Seal Docs: https://docs.sui.io/concepts/cryptography/seal
- Helper script source: `scripts/upload-to-walrus.sh`
