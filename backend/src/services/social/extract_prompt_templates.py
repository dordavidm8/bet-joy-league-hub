#!/usr/bin/env python3
"""
One-time script to extract the best Nano Banana Pro prompt templates
for each social media use-case category.

Run: python3 backend/src/services/social/extract_prompt_templates.py

Outputs: backend/src/services/social/nano-banana-templates.json
"""

import csv
import json
import re
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), 'nano-banana-pro-prompts.csv')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'nano-banana-templates.json')

# ── Category definitions ─────────────────────────────────────────────────────
# Keywords that signal a prompt belongs to each category
CATEGORY_KEYWORDS = {
    'social_media_post': [
        'social media', 'instagram', 'post', 'lifestyle', 'candid', 'selfie',
        'golden hour', 'street', 'urban', 'selfie', 'editorial', 'fashion portrait',
        'cinematic portrait', 'viral', 'engagement', 'photo', 'clean portrait',
        'football player', 'sports', 'athlete', 'dynamic', 'action'
    ],
    'infographic': [
        'infographic', 'data', 'chart', 'educational', 'explainer', 'visual',
        'stats', 'statistics', 'diagram', 'information', 'comparison',
        'vs.', 'versus', 'comparison', 'breakdown'
    ],
    'poster_flyer': [
        'poster', 'flyer', 'advertisement', 'ad campaign', 'promotional',
        'product shot', 'banner', 'marketing', 'brand', 'commercial',
        'announcement', 'event', 'risograph', 'typographic', 'graphic design',
        'product photography'
    ],
    'profile_avatar': [
        'avatar', 'profile', 'character sheet', 'headshot', 'portrait',
        'identity', 'character', '3d caricature', 'pixel art', 'cartoon',
        'illustration', 'anime', 'mascot', 'icon', 'pixar', 'comic'
    ],
    'sports_content': [
        'football', 'soccer', 'sports', 'athlete', 'stadium', 'match',
        'goal', 'player', 'team', 'sport', 'game', 'championship', 'league',
        'ball', 'pitch', 'jersey', 'kit'
    ]
}

MAX_PER_CATEGORY = 20  # Keep the best 20 per category

def score_prompt(row, category_keywords):
    """Score a prompt for relevance to a category."""
    text = f"{row['title']} {row['description']} {row['content'][:500]}".lower()
    score = sum(1 for kw in category_keywords if kw.lower() in text)
    # Prefer prompts with more content (richer templates)
    content_len_bonus = min(len(row['content']) / 1000, 3)
    return score + content_len_bonus

def clean_content(content):
    """Clean and normalize prompt content."""
    # Remove excessive whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)
    content = content.strip()
    return content

def extract_aspect_ratio(content):
    """Try to extract aspect ratio from content."""
    match = re.search(r'(?:aspect.?ratio|ar)\s*[:\s]+(\d+:\d+)', content, re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r'(\d+:\d+)\s*aspect ratio', content, re.IGNORECASE)
    if match:
        return match.group(1)
    return None

def main():
    print(f"Reading {CSV_PATH}...")
    all_rows = []
    
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['content'] and len(row['content']) > 50:
                all_rows.append(row)
    
    print(f"Loaded {len(all_rows)} prompts")
    
    output = {}
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        # Score all prompts for this category
        scored = []
        for row in all_rows:
            score = score_prompt(row, keywords)
            if score > 0:
                scored.append((score, row))
        
        # Sort by score descending
        scored.sort(key=lambda x: -x[0])
        top = scored[:MAX_PER_CATEGORY]
        
        output[category] = []
        for score, row in top:
            template = {
                'id': row['id'],
                'title': row['title'],
                'description': row['description'][:150],
                'content': clean_content(row['content'])[:3000],  # Cap at 3000 chars
                'score': round(score, 2),
                'aspect_ratio': extract_aspect_ratio(row['content']),
                'source': row['sourceLink'],
            }
            output[category].append(template)
        
        print(f"  {category}: {len(output[category])} templates (best score: {top[0][0]:.1f} — {top[0][1]['title']})")
    
    # Also add a 'default' fallback set with top-scoring overall
    all_scored = []
    for row in all_rows:
        total_score = sum(
            score_prompt(row, kws) 
            for kws in CATEGORY_KEYWORDS.values()
        )
        all_scored.append((total_score, row))
    all_scored.sort(key=lambda x: -x[0])
    
    output['default'] = []
    for score, row in all_scored[:15]:
        template = {
            'id': row['id'],
            'title': row['title'],
            'description': row['description'][:150],
            'content': clean_content(row['content'])[:3000],
            'score': round(score, 2),
            'aspect_ratio': extract_aspect_ratio(row['content']),
            'source': row['sourceLink'],
        }
        output['default'].append(template)
    print(f"  default: {len(output['default'])} templates")
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved to {OUTPUT_PATH}")
    total = sum(len(v) for v in output.values())
    print(f"   Total templates: {total}")

if __name__ == '__main__':
    main()
