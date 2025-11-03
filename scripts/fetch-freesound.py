#!/usr/bin/env python3
"""
Freesound API Integration Script
Downloads 5+ minute audio clips and uploads to Walrus testnet
"""

import os
import json
import sys
from pathlib import Path
import subprocess
import hashlib

# TODO: These would need to be installed via pip
# pip install requests

def get_freesound_samples():
    """
    Fetches sample data from Freesound API
    Note: This is a placeholder for demonstration
    In production, you would:
    1. Register at https://freesound.org/
    2. Get an API key
    3. Use requests library to query and download

    For now, we'll use placeholder data with instructions
    """

    print("Freesound Integration Script")
    print("=" * 50)
    print("\nTo fetch real audio from Freesound:")
    print("1. Register at https://freesound.org/")
    print("2. Create API key in account settings")
    print("3. Install dependencies: pip install requests")
    print("4. Uncomment and configure the code below")
    print("\nFor now, using placeholder sample data...")

    # Placeholder samples with metadata
    samples = [
        {
            "id": "sample_1",
            "name": "Ambient Meditation",
            "creator": "ambient_creator",
            "duration": 330,  # 5:30
            "url": "https://freesound.org/people/sample/sounds/123456/",
            "blob_id": "blob_ambient_123456789abcdef",
        },
        {
            "id": "sample_2",
            "name": "Forest Ambience",
            "creator": "nature_sounds",
            "duration": 375,  # 6:15
            "url": "https://freesound.org/people/sample/sounds/234567/",
            "blob_id": "blob_forest_234567890abcdef",
        },
        {
            "id": "sample_3",
            "name": "Cafe Atmosphere",
            "creator": "urban_recordist",
            "duration": 300,  # 5:00
            "url": "https://freesound.org/people/sample/sounds/345678/",
            "blob_id": "blob_cafe_345678901abcdef",
        },
    ]

    return samples


def validate_duration(duration_seconds):
    """Validate that audio is at least 5 minutes"""
    min_duration = 5 * 60  # 5 minutes
    if duration_seconds < min_duration:
        raise ValueError(f"Audio too short: {duration_seconds}s (min: {min_duration}s)")
    return True


def generate_seed_data(samples):
    """Generate seed data for database"""
    seed_data = []

    for sample in samples:
        validate_duration(sample["duration"])

        seed_entry = {
            "title": sample["name"],
            "creator": f"0x{hashlib.sha256(sample['creator'].encode()).hexdigest()[:40]}",  # Mock address
            "walrus_blob_id": sample["blob_id"],
            "preview_blob_id": f"{sample['blob_id']}_preview",
            "duration_seconds": sample["duration"],
            "quality_score": 75,
            "price": 1_000_000_000,  # 1 SONAR
            "media_type": "audio/wav",
            "languages": ["en"],
            "formats": ["wav"],
            "description": f"Professionally recorded audio from Freesound by {sample['creator']}",
        }

        seed_data.append(seed_entry)

        print(f"✓ {sample['name']}")
        print(f"  Duration: {sample['duration']}s")
        print(f"  Blob ID: {sample['blob_id']}")
        print()

    return seed_data


def save_seed_data(seed_data, output_path):
    """Save seed data to JSON file"""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(seed_data, f, indent=2)

    print(f"Seed data saved to {output_path}")
    return output_path


def main():
    """Main entry point"""
    try:
        print("Fetching Freesound samples...\n")
        samples = get_freesound_samples()

        print("\nValidating samples...\n")
        seed_data = generate_seed_data(samples)

        # Save seed data
        seed_file = Path(__file__).parent.parent / "backend" / "seed" / "kiosk-datasets.json"
        save_seed_data(seed_data, seed_file)

        print("\n" + "=" * 50)
        print("Next steps:")
        print("1. Upload each blob to Walrus testnet")
        print("2. Update blob_id values in seed data")
        print("3. Run: bun run seed:kiosk (from backend/)")
        print("\nNote: For production, implement actual Freesound API integration")

        return 0

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
